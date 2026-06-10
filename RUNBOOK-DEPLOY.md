# RUNBOOK — Staging deploy (API image + DB migrations + backfill + APK)

> Written 2026-06-10 after the staleness incident: everything fixed on `stage` since 06-04 had
> never deployed (no API deploy pipeline, no migration pipeline, migrations not runnable from the
> deployed image). This runbook is the manual, repeatable path until/unless the Phase 7 deploy
> automation is approved. Each step is copy-pasteable; values you must read from the AWS console
> are marked `<LIKE-THIS>`.
>
> **Order matters: API image → migrations → backfill → APK.** An old APK against the new API
> cannot sign in (the new `/auth/google` requires `installationId`) — acceptable for staging
> testers, who reinstall; do NOT distribute the APK before the API is live.

## 0. Prereqs

- AWS CLI authed against the staging account, region `ap-south-1` (the default the API's
  secrets-loader assumes).
- Docker with buildx; repo checked out at the `stage` commit you intend to ship.
- `infra/terraform/envs/staging/terraform.tfvars` still has `REPLACE_ME` placeholders — the live
  infra is console-managed, so **read the real names from the console first** (step 1).

## 1. Identify live resource names (console)

Terraform suggests these names; verify each in the console and substitute if they differ:

| What                     | Suggested name                               | Where to verify            |
| ------------------------ | -------------------------------------------- | -------------------------- |
| ECR repo                 | `humyn-api`                                  | ECR → Repositories         |
| ECS cluster              | `humyn-staging`                              | ECS → Clusters             |
| ECS service              | `humyn-staging-api`                          | ECS → cluster → Services   |
| Task definition family   | `humyn-staging-api`                          | ECS → Task definitions     |
| CloudWatch log group     | `/humyn/staging/api`                         | CloudWatch → Log groups    |
| API URL                  | `https://stage-hl-app-uploader.humynlabs.ai` | known-good                 |
| Mobile CodeBuild project | `<console>`                                  | CodeBuild → Build projects |
| APK bucket               | `humyn-apk-stage`                            | per `buildspec.yml`        |

Also note (ECS → service → networking): the service's **private subnet ids** and **security
group** — the one-off migration task reuses them.

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-south-1
ECR=${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
CLUSTER=humyn-staging
SERVICE=humyn-staging-api
LOG_GROUP=/humyn/staging/api
```

## 2. Build + push the API image from `stage` HEAD

```bash
git checkout stage && git pull
SHA8=$(git rev-parse --short=8 HEAD)

# GIT_SHA is baked into the image (Dockerfile ARG → ENV) and surfaced by /healthz —
# this is the deploy stamp that makes a stale image detectable from a curl.
docker build -f apps/api/Dockerfile --platform linux/amd64 \
  --build-arg GIT_SHA=${SHA8} \
  -t ${ECR}/humyn-api:${SHA8} .

aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR}
docker push ${ECR}/humyn-api:${SHA8}
```

Point the service at the new tag — register a new task-definition revision with the new image and
update the service (if the task def uses a floating `latest` tag, push that tag too and
`--force-new-deployment` instead):

```bash
# Render a new revision of the current task def with only the image swapped:
aws ecs describe-task-definition --task-definition ${SERVICE} --query 'taskDefinition' > /tmp/td.json
python3 - <<EOF
import json
td = json.load(open('/tmp/td.json'))
for k in ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy']:
    td.pop(k, None)
td['containerDefinitions'][0]['image'] = "${ECR}/humyn-api:${SHA8}"
json.dump(td, open('/tmp/td-new.json','w'))
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/td-new.json --query 'taskDefinition.revision'
aws ecs update-service --cluster ${CLUSTER} --service ${SERVICE} --task-definition ${SERVICE} --force-new-deployment
aws ecs wait services-stable --cluster ${CLUSTER} --services ${SERVICE}
```

> **Scale-out warning:** keep the service at `desired_count = 1`. The single-device-eviction LRU
> (60 s TTL, `auth/installation-binding.ts`) and the hourly in-process thumbnail sweep both assume
> a single instance; the API logs this invariant at boot.

## 3. Apply DB migrations (0010 → 0018)

Staging RDS is in a private subnet with no bastion — run the migration **as a one-off ECS task
using the new image** (same task role/network as the service). The image now contains
`dist/scripts/migrate.js` (compiled; idempotent; walks `src/db/migrations/*.sql` lexicographically
and records applied files in `schema_migrations`).

```bash
SUBNETS='<private-subnet-id-1>,<private-subnet-id-2>'   # from step 1
SG='<api-task-security-group>'                          # from step 1

aws ecs run-task \
  --cluster ${CLUSTER} \
  --launch-type FARGATE \
  --task-definition ${SERVICE} \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SG}],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"<container-name-from-taskdef>","command":["node","dist/scripts/migrate.js"]}]}' \
  --query 'tasks[0].taskArn' --output text
```

Watch it (exit code must be 0):

```bash
aws logs tail ${LOG_GROUP} --since 10m --follow
# Expect: "Applying 0010_*.sql ..." ... "Migrations: N applied, M skipped (total T)."
```

**Verify:** re-run the same one-off task — every file must print `Skipping <file> (already
applied).` and the summary must end `... skipped (total T)` with **0 applied**, and the listing
must include `0018_backfill_practice_all_users.sql`. (Equivalently, with any psql access:
`SELECT filename FROM schema_migrations ORDER BY filename;` ends at `0018_*`.)

> Alternative if you have SSM port-forwarding to RDS:
> `DATABASE_URL='postgres://...' pnpm --filter @humyn/api db:migrate`

## 4. Run the thumbnail backfill once

Same one-off task mechanism, with `RECORDINGS_BUCKET` already in the task env (ffmpeg is in the
image). The API also self-heals from 06-10 on (in-process sweep at boot + hourly), so this manual
run just front-loads the fleet recovery:

```bash
aws ecs run-task \
  --cluster ${CLUSTER} \
  --launch-type FARGATE \
  --task-definition ${SERVICE} \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SG}],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"<container-name-from-taskdef>","command":["node","dist/scripts/backfill-thumbnails.js"]}]}'
# Log line on success: "[backfill-thumbnails] complete — candidates=N generated=G failed=F"
```

## 5. Build + distribute the APK (CodeBuild)

```bash
aws codebuild start-build --project-name <mobile-codebuild-project> --source-version stage
```

- **Before installing**, verify the Firebase App Distribution release notes read
  `Build <new sha8> from stage`.
- Check the CodeBuild project's trigger config (console → project → Build triggers / webhook):
  if it does **not** auto-build on `stage` pushes, every future client fix needs this manual
  `start-build` — note it here and consider wiring the webhook (Phase 7 decision).

## 6. Post-deploy gates (all must pass before any bug retest)

```bash
API=https://stage-hl-app-uploader.humynlabs.ai

# 6a. Deploy stamp — proves WHICH build is live:
curl -s ${API}/healthz
# → {"status":"ok","sha":"<the SHA8 you built>"}   ("unknown" or old sha = wrong image)

# 6b. Practice route exists (was 404 on the stale image) — 401 proves it's routed + authed:
curl -s -i -X POST ${API}/me/practice-complete \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen | tr 'A-Z' 'a-z')" \
  -d '{}' | head -1
# → HTTP/2 401   (stale image returned 404 "Route not found")

# 6c. New init schema live — a schema-VALID new-shape body with no auth must 401.
#     The stale image 400s this body demanding the removed fileSha256/imuSha256.
curl -s -i -X POST ${API}/recordings/init \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen | tr 'A-Z' 'a-z')" \
  -d '{
    "recordingId": "01HZZZPROBE000000000000000",
    "taskId":      "01HZZZPROBE000000000000001",
    "practice": false,
    "partsCount": 1,
    "durationMs": 180000,
    "fileSizeBytes": 1,
    "imuSizeBytes": 1,
    "capturedAt": "2026-06-10T00:00:00Z"
  }' | head -1
# → HTTP/2 401   (NOT a 400 naming fileSha256)

# 6d. ffmpeg present in the live image:
aws logs tail ${LOG_GROUP} --since 30m | grep -m1 'ffmpeg present'
# → "ffmpeg present — server-side poster thumbnails (Bug 6 / D5) enabled"
```

## 7. On-device

1. Install the new APK from Firebase App Distribution (verify release notes first, step 5).
2. Sign out / sign in once — legacy JWTs get `reauth-required` **by design** (single-device
   binding now requires an `installationId` claim).
3. Profile footer must show `0.1.0-<sha8>` (buildspec now stamps `-PhumynVersionName`); the
   constant `0.1.0-apk (1)` means an old APK.
4. Then run the §10 smoke table in `IMPLEMENTATION-PLAN-260610.md`.

## 8. Optional: seed `app_versions` for the in-app updater

The in-app updater (`GET /app/version`, `apkRollout` flavor) currently 404s because the table is
empty. Seeding it enables the force-upgrade path for stragglers on old APKs:

```sql
INSERT INTO app_versions (flavor, version_name, version_code, apk_url, sha256, rollout_note)
VALUES ('apkRollout', '0.1.0-<sha8>', <versionCode>,
        'https://humyn-apk-stage.s3.ap-south-1.amazonaws.com/apks/app-apkRollout-staging-latest.apk',
        '<sha256 of the apk file>', 'staging rollout <date>');
```

(Adjust columns to the live `app_versions` schema if it differs — check `\d app_versions`.)

## 9. Diagnostics: "app exits during the battery ask" (Bug 5)

The owner can no longer reproduce this (the standalone battery screen it crashed from was
deleted 06-09; Phase 5 additionally guarded the compat camera probes, relocated the ask to
CompatPassScreen — after the probes, no camera open — and launches the dialog from the Activity
so dismissal can't land on the launcher). If it ever recurs, capture evidence in this order:

1. **Live filtered logcat while reproducing** (crash signatures + camera lifecycle + the
   battery-helper's own warnings):

   ```bash
   adb logcat -v time AndroidRuntime:E ReactNativeJS:E CameraService:I ActivityManager:I HumynBattOpt:W *:S
   ```

2. **Post-mortem crash buffer** (works after the fact — the crash ring buffer survives):

   ```bash
   adb logcat -b crash -d
   ```

3. **Crashlytics console** filtered to the `apkRollout` app — the probe-window failure mode
   presents as a native `CameraAccessException` / `IllegalStateException` on an
   `EncoderProbe`/`ImuProbe` HandlerThread; the task-affinity failure mode shows NO crash at
   all (the app was simply tasked away — check `ActivityManager:I` lines for the dialog's task).

Distinguish the two failure modes: a **crash** leaves an `AndroidRuntime:E` line + a Crashlytics
event; the **back-to-launcher quirk** leaves neither (the process stays alive — `adb shell pidof
ai.humynlabs.capture` still prints a pid). The second is cosmetic-but-confusing; it means the
dialog opened in its own task (the pre-Phase-5 `FLAG_ACTIVITY_NEW_TASK` path — verify the
installed build is current).

## Known sharp edges

- **Old APK + new API:** sign-in 400s (`installationId` required) and legacy JWTs 401
  (`reauth-required`). Staging testers must install the new APK and re-sign-in once.
- **Idempotency poisoning (why API deploys first):** the pre-06-10 server memoized 4xx responses
  for 24 h under the client's fixed per-row idempotency key. The new image only memoizes 2xx —
  but deploy the API before testers start retrying uploads.
- **`desired_count = 1`** is a correctness invariant (eviction LRU + thumbnail sweep) — do not
  scale out without revisiting `auth/installation-binding.ts` and the sweep scheduling.
