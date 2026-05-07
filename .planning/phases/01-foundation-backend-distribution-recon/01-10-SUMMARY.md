---
phase: 01-foundation-backend-distribution-recon
plan: 10
subsystem: infra
status: partial-pending-checkpoint
tags:
  [
    terraform,
    aws,
    vpc,
    rds,
    pgvector,
    ecs,
    fargate,
    alb,
    s3,
    cloudfront,
    iam,
    secrets-manager,
    oidc,
    github-actions,
  ]

# Dependency graph
requires:
  - phase: 01
    plan: 03
    provides: LocalStack-equivalent dev infra; lifecycle JSON shape (GLACIER_IR @ +7d, DEEP_ARCHIVE @ +90d) — used byte-identical here for prod parity (LEGAL-05)
  - phase: 01
    plan: 04
    provides: Fastify api scaffold including /healthz route — referenced by ECS task healthCheck and ALB target-group health_check
  - phase: 01
    plan: 05
    provides: Auth route names + flavor-allowlist conventions used by the env-var contract injected at task start
  - phase: 01
    plan: 07
    provides: API-09 CloudFront-signed playback URL pattern — drove inclusion of cloudfront/signing-key + cloudfront/key-pair-id secrets in module/secrets
  - phase: 01
    plan: 08
    provides: humyn-feedback-${env} bucket — S3 module includes it as the third bucket so prod has the same shape as dev
provides:
  - 7 Terraform modules (network / rds / secrets / s3 / cloudfront / iam / ecs) covering VPC + Postgres + ALB-fronted Fargate + 3 buckets + APK distribution + GitHub OIDC role
  - Two env compositions (staging + prod) wiring all 7 modules with env-specific tfvars + remote-state backends
  - One-time state-bucket + DynamoDB lock bootstrap script (idempotent, runs out-of-band before first init)
  - Day-zero S3 lifecycle on humyn-recordings-${env} (GLACIER_IR @ +7d, DEEP_ARCHIVE @ +90d) per LEGAL-05 — storage-class transitions only, byte-preserving
  - Bucket policies on all 3 buckets denying insecure transport; recordings additionally denies unencrypted PUT
  - ECS task definition with secrets injection (JWT_SIGNING_SECRET + PLAY_INTEGRITY_SA_KEY_JSON + DATABASE_URL via :url:: extraction)
  - Scoped IAM: execution role gets secretsmanager:GetSecretValue on exactly 3 ARNs; task role gets per-bucket prefix permissions per RESEARCH §3.8
  - GitHub Actions OIDC provider + humyn-${env}-github-deploy role with trust locked to repo:humyn-labs/homelander:* (T-1.10-05)
affects:
  - 01-12 (e2e/integration tests can target the staging stack once deployed)
  - 02+ (ECR repo + ALB + RDS endpoints are the deploy targets for every subsequent api commit)

# Tech tracking
tech-stack:
  added:
    - terraform >= 1.10 (declared in required_version of envs/staging/backend.tf + envs/prod/backend.tf)
    - hashicorp/aws ~> 5.80 (provider; covers all AWS resources here including provider 5.x lifecycle filter requirement)
    - hashicorp/tls ~> 4.0 (provider; only used in iam module to fetch the GitHub OIDC thumbprint)
  patterns:
    - 'Provider-aliased CloudFront cert (Pattern 38): the CloudFront ACM cert lives in us-east-1 regardless of the rest of the stack; the cloudfront module declares `configuration_aliases = [aws.us_east_1]` and the env composition passes `aws.us_east_1 = aws.us_east_1` in the providers map. Future us-east-1 resources (CloudFront real-time logs, etc.) reuse this same alias.'
    - 'Bucket-policy belt-and-braces (Pattern 39): every bucket gets BOTH a `aws_s3_bucket_public_access_block` resource AND a bucket policy with `aws:SecureTransport=false → Deny`. Public-access-block guards against future ACL/policy mistakes; TLS-deny guards against in-flight interception. Recordings additionally denies unencrypted PUT (s3:x-amz-server-side-encryption != AES256).'
    - 'Secret ARN scoping at THREE places (Pattern 40): execution role inline policy lists each secret ARN; task definition `secrets` field references each ARN; the ARN itself is the only thing that flows out of the secrets module. Reading the actual secret value requires `secretsmanager:GetSecretValue` permission, which only the ECS execution role has — applies to T-1.10-08.'
    - 'Single-AZ-but-multi-AZ-ready (Pattern 41): the network module declares only one private + one public subnet today, but the VPC, IGW, route tables, and NAT GW are all reusable as-is. Phase 5 multi-AZ migration adds subnets in `${region}b/c` to the existing route table associations + db_subnet_group + ALB subnets list, no rebuild. RDS `multi_az = false` flips to `true` in place.'
    - 'ECS task `secrets` field over app-side fetch (Pattern 42): the api never directly calls SecretsManager.GetSecretValue at runtime — ECS injects JWT_SIGNING_SECRET, PLAY_INTEGRITY_SA_KEY_JSON, DATABASE_URL as env vars at task start using the execution role. The `:url::` JSON-key suffix extracts a single field from the RDS-managed secret JSON blob. App code is identical between LocalStack-dev (env vars from .env) and prod (env vars from ECS-injected secrets).'
    - "GitHub OIDC sub-claim binding (Pattern 43): the deploy role's trust policy uses `StringLike` on `token.actions.githubusercontent.com:sub = repo:${owner}/${repo}:*`. Tokens minted by GitHub for forks of the repo, other repos in the same org, or pull-request workflows from forks have a different sub claim and fail the gate. Plus an `aud = sts.amazonaws.com` StringEquals check rejects tokens minted for other audiences."
    - "Idempotent bootstrap script (Pattern 44): `bootstrap-state-bucket.sh` head-bucket-checks before create, describe-table-checks before create — running it twice is a no-op. Encryption + versioning + public-access-block are applied on every run because they're idempotent put-* operations and we want them re-asserted on re-run."

key-files:
  created:
    - infra/terraform/modules/network/{main,variables,outputs}.tf — VPC, public_a + private_a subnets, IGW, NAT GW, sg_alb (443 from internet), sg_fargate (8080 from sg_alb), sg_rds (5432 from sg_fargate)
    - infra/terraform/modules/rds/{main,variables,outputs}.tf — Postgres 17.2 + pgvector parameter group (shared_preload_libraries=pg_stat_statements,vector), single-AZ, manage_master_user_password=true, deletion_protection gated on env=="prod"
    - infra/terraform/modules/secrets/{main,outputs}.tf — 4 Secrets Manager entries (jwt/signing-secret, gcp/play-integrity-sa-key, cloudfront/signing-key, cloudfront/key-pair-id) with 7-day recovery windows
    - infra/terraform/modules/s3/{main,variables,outputs}.tf — humyn-recordings-${env} (versioned + day-zero lifecycle Glacier IR @ +7d / Deep Archive @ +90d / abort_incomplete_multipart_upload @ +1d / DenyUnencryptedPut + DenyInsecureTransport), humyn-apk-${env} (DenyInsecureTransport), humyn-feedback-${env} (90-day expiration + DenyInsecureTransport); all 3 with public-access-block + AES256 default encryption
    - infra/terraform/modules/cloudfront/{main,variables,outputs}.tf — us-east-1 ACM cert for apk.humyn.ai (DNS-validated), OAC + APK distribution with TLS 1.2+ minimum and viewer_protocol_policy=redirect-to-https
    - infra/terraform/modules/iam/{main,variables,outputs}.tf — GitHub OIDC provider (token.actions.githubusercontent.com, audience sts.amazonaws.com) + humyn-${env}-github-deploy role with trust locked to repo:owner/repo:* and a Phase-1-permissive deploy policy
    - infra/terraform/modules/ecs/{main,variables,outputs}.tf — ECS cluster (Container Insights on), CloudWatch log group /humyn/${env}/api (30d), task execution role (AmazonECSTaskExecutionRolePolicy + inline GetSecretValue on the 3 ARNs), task role (per-bucket-prefix S3 permissions per §3.8), task definition (cpu=512 / mem=1024 / awsvpc / Fargate; secrets injection; healthCheck on /healthz), ALB (TLS 1.3 minimum), target group (health_check on /healthz), HTTPS listener, ECS service (desired_count=1)
    - infra/terraform/envs/staging/{main,variables,outputs,backend,terraform}.tf{,vars} — wires the 7 modules; backend on humyn-tf-state-staging with humyn-tf-locks DynamoDB; instance_class db.t4g.medium / 100 GiB
    - infra/terraform/envs/prod/{main,variables,outputs,backend,terraform}.tf{,vars} — same shape; backend on humyn-tf-state-prod; instance_class db.t4g.large / 200 GiB
    - infra/terraform/scripts/bootstrap-state-bucket.sh — idempotent S3 + DynamoDB bootstrap; mode 0755
    - infra/terraform/.gitignore — excludes *.tfstate*, .terraform/, *.tfplan, *.auto.tfvars, override.tf
    - infra/terraform/README.md — bootstrap workflow, daily workflow, secrets seeding (incl. CloudFront keypair generation), region split, hard rules, first-apply gate
  modified: []

key-decisions:
  - 'Used the plan body''s CPU=512/memory=1024 task-def size, not RESEARCH §3.5''s 1024/2048. The plan body''s acceptance criteria explicitly grep for `cpu = "512"` and `memory = "1024"`; RESEARCH was an earlier draft. Phase 5 will right-size based on real load data — bumping the values is a single-line task-def edit + a `terraform apply`.'
  - "Healthcheck path is `/healthz` (matches plan 04's Fastify route), not `/health` from RESEARCH §3.5. Same reason — plan body acceptance criteria override RESEARCH where they differ."
  - 'Empty `filter {}` block in every `aws_s3_bucket_lifecycle_configuration` rule. AWS provider 5.x emits a deprecation warning if neither `filter` nor `prefix` is set on a lifecycle rule. Empty `filter {}` matches all objects (semantic equivalent of the deprecated empty-prefix) and silences the warning at apply time.'
  - 'Three secrets in the execution-role inline policy, not two as RESEARCH §3.4 originally listed. Added the RDS-managed master credential ARN explicitly so the `:url::` JSON-key extraction in the task definition has a corresponding GetSecretValue grant. Without this, the task would fail to start with a Secrets-Manager-access-denied error.'
  - "Bucket policy `DenyInsecureTransport` on the APK bucket too, not just recordings + feedback as the plan body's grep targets. The CloudFront viewer_protocol_policy=redirect-to-https is the user-facing layer; the bucket-side TLS-only deny is the belt-and-braces in case someone manually crafts a presigned URL or accesses the regional endpoint directly. Adds zero attack surface; aligns the three buckets to the same hardening profile."
  - "Added an `iam` Phase-1-permissive deploy-role policy on top of the plan body's list (added `ecr:*`). Without ecr:* the GitHub Actions deploy can't push images to the ECR repo before redeploying the task. ec2/rds/ecs/etc. were already in the plan-body list; ecr is structurally required for any container-deploy CI."
  - "The `aws_iam_role_policy` resources got explicit `name` fields so they're stable across plan/apply (Terraform's auto-generated names include random suffixes, which means refactoring a name forces a destroy/create instead of an in-place update)."
  - "DynamoDB lock table is shared across staging + prod (one table, two buckets) — Terraform's lock LockID is `<bucket>/<key>-md5` so collisions are impossible, and one shared table avoids per-env IaC management overhead."
  - 'Provider `default_tags = { Env, ManagedBy=terraform, Project=homelander }` is set in both env backends (default and us_east_1 alias). Every taggable AWS resource gets these tags automatically — useful for cost-attribution and Phase-5 IAM tightening (`aws:ResourceTag/Env=$env` conditions).'
  - 'The recordings playback CloudFront DISTRIBUTION is intentionally NOT created at MVP — only the signing keypair-shell is provisioned. Plan 07 mints S3 presigned URLs directly via @aws-sdk/cloudfront-signer. A CloudFront-fronted recordings distribution is a Phase 5 follow-up once the playback hit-rate justifies the per-distribution cost.'

patterns-established: ['{see tech-stack.patterns above — Pattern 38..44}']

requirements-completed: [API-17, DIST-01, LEGAL-05]
requirements-pending-apply: [API-17, DIST-01, LEGAL-05] # Required to be marked complete only after the human-verify apply gate

# Metrics
duration: ~25 min
completed: 2026-05-07
status_note: |
  Tasks 1+2+3 (autonomous HCL authoring) are complete and committed. Task 4
  (first `terraform apply` against real AWS staging) is the autonomous: false
  human-verify checkpoint — see "Checkpoint Reached" section below.
---

# Phase 01 Plan 10: AWS Terraform Foundation Summary (PARTIAL — pending apply gate)

**7 Terraform modules + 2 env compositions wire VPC + Postgres 17 + Fargate + ALB + 3 S3 buckets + CloudFront + IAM (+GitHub OIDC) for staging and prod, with day-zero LEGAL-05 lifecycle on recordings, denyinsecuretransport on every bucket, scoped task/execution roles per RESEARCH §3.8, and a manual one-time bootstrap script for the S3+DynamoDB remote state. Static structure complete and committed; the first `terraform apply` is the autonomous: false human-verify gate at Task 4.**

## Performance

- **Duration:** ~25 min (Tasks 1+2+3 autonomous authoring)
- **Started:** 2026-05-07T15:55:00Z (approx)
- **Completed (autonomous portion):** 2026-05-07T16:20:00Z (approx)
- **Tasks committed:** 3 / 4 (Task 4 is checkpoint-gated)
- **Files created:** 33 (24 .tf + 2 .tfvars + 1 .sh + 1 .gitignore + 1 .md + auto-generated none)

## Accomplishments (Tasks 1+2+3)

**Task 1 — Six modules (network/rds/secrets/s3/cloudfront/iam):**

- **`modules/network/`** — VPC `10.0.0.0/16` with one public subnet `10.0.0.0/20` (ALB + NAT GW) and one private subnet `10.0.16.0/20` (Fargate + RDS) in `${region}a`. IGW + EIP-backed NAT GW + two route tables + associations. Three security groups — `sg_alb` (ingress 443 from `0.0.0.0/0`), `sg_fargate` (ingress 8080 from `sg_alb` only via separate rule resource to dodge the SG-to-SG circular-ref pitfall), `sg_rds` (ingress 5432 from `sg_fargate` only). Single-AZ at MVP per D-HOST-02; the same module flips to multi-AZ in Phase 5 by adding subnets in `b/c`.
- **`modules/rds/`** — `aws_db_instance` Postgres 17.2 on `gp3` storage; parameter group `humyn-pg17-pgvector-${env}` declares `shared_preload_libraries = pg_stat_statements,vector` (apply_method `pending-reboot`) plus slow-query logging. `multi_az = false` (D-HOST-02), `manage_master_user_password = true` so Secrets Manager auto-creates a JSON secret with the `url` key consumable by ECS via `:url::` extraction. `deletion_protection` and `skip_final_snapshot` flip on `var.env == "prod"`.
- **`modules/secrets/`** — 4 Secrets Manager entries (`humyn/jwt/signing-secret`, `humyn/gcp/play-integrity-sa-key`, `humyn/cloudfront/signing-key`, `humyn/cloudfront/key-pair-id`) with 7-day recovery windows. Initial values are seeded out-of-band — the module file's comment block walks through each `put-secret-value` call. The CloudFront keypair pair (signing-key private PEM + key-pair-id string) is required by API-09 in plan 07's `/recordings/:id` playback URL signing.
- **`modules/s3/`** — Three buckets with hard-rule policies:
  - `humyn-recordings-${env}` — versioned, AES256 default encryption, public-access blocked, day-zero lifecycle (`GLACIER_IR @ +7d`, `DEEP_ARCHIVE @ +90d`, `abort_incomplete_multipart_upload @ +1d`), `DenyUnencryptedPut` (StringNotEquals `s3:x-amz-server-side-encryption=AES256`), `DenyInsecureTransport` (`aws:SecureTransport=false`).
  - `humyn-apk-${env}` — public-access blocked, AES256 default encryption, `DenyInsecureTransport`. Public reads happen via CloudFront OAC only.
  - `humyn-feedback-${env}` — public-access blocked, AES256 default encryption, 90-day expiration, `DenyInsecureTransport`. Plan 08's diagnostic bucket.
  - All three lifecycle rules use empty `filter {}` blocks to satisfy AWS provider 5.x's "either filter or prefix" requirement (silences a deprecation warning at apply).
- **`modules/cloudfront/`** — `aws_acm_certificate.apk` for `apk.humyn.ai` provisioned via the `aws.us_east_1` aliased provider (CloudFront cert constraint). `aws_cloudfront_origin_access_control` (`signing_behavior = always`, `signing_protocol = sigv4`). `aws_cloudfront_distribution` aliasing `apk.humyn.ai`, `viewer_protocol_policy = redirect-to-https`, TLS 1.2+ minimum (`TLSv1.2_2021`), `geo_restriction.restriction_type = none`. The recordings playback _distribution_ is intentionally not created — at MVP, plan 07 signs S3 presigned URLs directly via the @aws-sdk/cloudfront-signer code path; the CloudFront keypair _shells_ live in the secrets module.
- **`modules/iam/`** — `aws_iam_openid_connect_provider.github` with thumbprint pulled from the actual GitHub OIDC discovery endpoint via `data.tls_certificate.github`. Trust policy uses two conditions: `StringEquals` on `aud = sts.amazonaws.com` and `StringLike` on `sub = repo:${var.github_owner}/${var.github_repo}:*` — tokens minted by GitHub for forks, other repos, or different audiences are rejected (T-1.10-05). Deploy-role policy is Phase-1-permissive (ec2 / rds / ecs / elasticloadbalancing / iam / s3 / cloudfront / secretsmanager / logs / dynamodb / kms / acm / **ecr** — added ecr beyond the plan body so CI can push images before redeploying the task).

**Task 2 — ECS module:**

- `aws_ecs_cluster.main` with Container Insights on, `aws_cloudwatch_log_group.api` (`/humyn/${env}/api`, 30-day retention).
- Two distinct IAM roles, both assumable by `ecs-tasks.amazonaws.com`:
  - **Execution role** — AWS-managed `AmazonECSTaskExecutionRolePolicy` (ECR pulls, CloudWatch writes) plus a custom inline `secretsmanager:GetSecretValue` policy listing **exactly three ARNs** (jwt + play-integrity + RDS master). No `*:*`, no Resource expansion.
  - **Task role** — runtime container permissions per RESEARCH §3.8: `s3:PutObject + GetObject + AbortMultipartUpload + ListMultipartUploadParts` on `humyn-recordings-${env}/*` plus `s3:ListBucket` on the recordings bucket itself, `s3:GetObject` on `humyn-apk-${env}/*` (read-only — APK uploads happen via CI), `s3:PutObject + GetObject` on `humyn-feedback-${env}/*` (plan 08).
- **Task definition** — Fargate, awsvpc, CPU 512 / memory 1024, container `api` on port 8080. `environment` carries the non-secret values (`NODE_ENV`, `AWS_REGION`, `GOOGLE_WEB_CLIENT_ID`, `RECORDINGS_BUCKET`, `APK_BUCKET`, `FEEDBACK_BUCKET`). `secrets` carries the three secret-injected env vars (`JWT_SIGNING_SECRET`, `PLAY_INTEGRITY_SA_KEY_JSON`, `DATABASE_URL = ${rds_master_secret_arn}:url::` — the `:url::` suffix extracts only the `url` JSON-key from the RDS-managed secret blob). `healthCheck` runs `wget -q -O- http://localhost:8080/healthz`. Logs go to the CloudWatch group via the `awslogs` driver.
- **ALB** — public-facing, `application` type, attached to `sg_alb`, in the public subnet. Target group on port 8080, `target_type = ip` (required for awsvpc), health_check `/healthz` matcher 200. HTTPS listener on 443 with `ELBSecurityPolicy-TLS13-1-2-2021-06` (TLS 1.3 minimum).
- **ECS service** — `desired_count = 1` per D-HOST-03, `assign_public_ip = false`, deployed in the private subnet behind the ALB. Deployments depend on the HTTPS listener (so a fresh apply doesn't 503 mid-rollout).

**Task 3 — Env compositions + bootstrap + .gitignore + README:**

- **`envs/staging/`** — `backend.tf` declares Terraform 1.10+, AWS provider `~> 5.80`, TLS provider `~> 4.0`, S3 backend on `humyn-tf-state-staging` with DynamoDB lock `humyn-tf-locks` (encrypted=true). Two providers: default `ap-south-1` and aliased `aws.us_east_1` (CloudFront-only), both with `default_tags { Env, ManagedBy = terraform, Project = homelander }`. `main.tf` wires the 7 modules; the cloudfront module is invoked with `providers = { aws = aws, aws.us_east_1 = aws.us_east_1 }`. `terraform.tfvars` ships with `REPLACE_ME_*` placeholders for the manually-bootstrapped values (Google Web Client ID from Firebase Console, ECR repo URL, ACM cert ARN). `outputs.tf` surfaces `alb_dns_name`, `rds_endpoint`, `apk_distribution_domain`, `apk_distribution_id`, `github_deploy_role_arn`, `recordings_bucket_name`, `feedback_bucket_name`.
- **`envs/prod/`** — same shape, `humyn-tf-state-prod` backend, `db.t4g.large` / 200 GiB. RDS deletion_protection + skip_final_snapshot flip automatically because the `rds` module gates them on `var.env == "prod"`.
- **`scripts/bootstrap-state-bucket.sh`** (mode 0755) — idempotent: `head-bucket` checks before create, `describe-table` checks before create. Re-runs are no-ops. Encryption + versioning + public-access block are re-asserted on every run (idempotent put-\* operations). Echos a "next: cd envs/${env} && terraform init" hint at the end.
- **`.gitignore`** — excludes `*.tfstate*`, `.terraform/`, `.terraform.lock.hcl`, `*.tfplan`, `crash.log`, `*_override.tf*`, `*.auto.tfvars*`, `terraform.rc` / `.terraformrc`. State NEVER lives in git.
- **`README.md`** — bootstrap workflow (with `aws sts get-caller-identity` confirmation step), per-env manual prerequisites (ACM cert in ap-south-1, ECR repo creation), daily workflow (fmt → validate → plan → apply), region split rationale, secrets-seeding shell snippets (incl. CloudFront `create-public-key` step + the four `put-secret-value` calls), modules-at-a-glance table, hard rules, and the explicit first-apply gate callout.

## Task Commits

Three task commits land cleanly on `main` (pre-commit hook ran `lint-staged` + `pnpm typecheck`; all green; prettier reformatted the README mid-commit per Pattern 5):

1. **Task 1: 6 modules (network + rds + secrets + s3 + cloudfront + iam)** — `430e17a` (feat)
2. **Task 2: ECS module (cluster + task def + ALB + IAM)** — `9e52db8` (feat)
3. **Task 3: env compositions + bootstrap + .gitignore + README** — `ad93d17` (feat)

**Plan metadata commit:** appended below post-summary (only after the apply-gate is approved — see Checkpoint Reached).

## Static Verification (executed on this machine)

Plan 10 declares two automated verifications:

1. `terraform fmt -check -recursive infra/terraform/` exits 0
2. `cd infra/terraform/envs/{staging,prod} && terraform init -backend=false && terraform validate` exits 0

**Neither could be executed locally** — `terraform` CLI is not installed on this dev machine, and the orchestrator prompt explicitly forbids installing it (`Do NOT install the terraform CLI yourself if it's not present — fall back to tflint or schema-only static checks and document the gap in the checkpoint return`). `tflint` is also not installed. No alternative HCL parser (e.g. `npm`-published HCL libs) is available either.

**What I did instead — schema-only static checks:**

- Walked every `*.tf` file by hand, comparing against the AWS provider 5.x docs format for each resource type used.
- Confirmed every `aws_s3_bucket_lifecycle_configuration` rule has either `filter {}` or `prefix` (provider 5.x requirement) — added empty `filter {}` blocks where the plan body omitted them.
- Confirmed the cloudfront module's `configuration_aliases = [aws.us_east_1]` is paired with the env composition's `providers = { aws = aws, aws.us_east_1 = aws.us_east_1 }` — both sides correct.
- Confirmed every `module` block's input variables match the module's `variables.tf` declaration.
- Confirmed every `output` referenced in `envs/*/main.tf` (e.g. `module.network.private_subnet_id`) exists in the corresponding module's `outputs.tf`.
- Ran `bash -n infra/terraform/scripts/bootstrap-state-bucket.sh` — bash syntax OK.
- Ran the plan-body's `grep` acceptance criteria for all three tasks — every grep target found.

**The `terraform fmt -check` and `terraform validate` runs MUST be executed by the human at the apply gate.** If either fails, that's a Rule-1 fix-and-re-commit. Concrete commands the human runs at the apply gate (Task 4):

```bash
cd infra/terraform
terraform fmt -check -recursive .            # exits 0 if all files are canonical-formatted
cd envs/staging && terraform init -backend=false && terraform validate
cd ../prod && terraform init -backend=false && terraform validate
```

If any of these surface diff/error output, treat as a deviation Rule 1 (auto-fix bug) — fix locally, re-commit, then resume the apply-gate flow.

## Files Created / Modified

(See `key-files.created` in the frontmatter for the canonical list — 33 files across `infra/terraform/{modules,envs,scripts}/` plus `.gitignore` and `README.md`.)

## Decisions Made

(See `key-decisions` in the frontmatter — 10 decisions, including the CPU/mem deviation from RESEARCH, the `/healthz` healthcheck path, the empty `filter {}` for AWS provider 5.x, the third secret ARN in the execution-role inline policy, the bucket-policy hardening of the APK bucket beyond the plan body, the `ecr:*` addition to the deploy role, the explicit `name` on every inline policy, the shared DynamoDB lock table, the `default_tags`, and the deferred recordings playback distribution.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Empty `filter {}` block on every `aws_s3_bucket_lifecycle_configuration` rule**

- **Found during:** Static review of the plan body's HCL snippets after writing Task 1.
- **Issue:** AWS provider 5.x emits a deprecation warning if a lifecycle rule has neither `filter` nor `prefix`. Apply might still succeed, but the warning clutters CI and leaves the rule on shaky ground for provider 6.x where it becomes an error.
- **Fix:** Added empty `filter {}` to the rule blocks in `modules/s3/main.tf` (recordings tier-down + feedback expire-old-feedback). Empty `filter {}` matches all objects (semantic equivalent of the deprecated empty-prefix).
- **Files modified:** `infra/terraform/modules/s3/main.tf` (Task 1 commit).
- **Commit:** `430e17a`.

**2. [Rule 2 - Missing critical] Third secret ARN in execution-role inline policy**

- **Found during:** Cross-checking the plan body's `secrets` field on the task definition (which lists 3 entries including `DATABASE_URL = ${rds_master_secret_arn}:url::`) against the plan body's `ecs_execution_secrets` policy (which the plan body's HCL writes as `[var.jwt_secret_arn, var.gcp_sa_secret_arn, var.rds_master_secret_arn]` — but the plan body's prose summary says "two secrets at Phase 1").
- **Issue:** Without the third ARN in the GetSecretValue grant, the task fails to start with an access-denied error on `DATABASE_URL` resolution.
- **Fix:** Kept all three ARNs in `ecs_execution_secrets` (matches the plan body's HCL, contradicts only the prose summary).
- **Files modified:** `infra/terraform/modules/ecs/main.tf` (Task 2 commit).
- **Commit:** `9e52db8`.

**3. [Rule 2 - Missing critical] `ecr:*` added to GitHub deploy-role policy**

- **Found during:** Reviewing the plan body's IAM module — the `Action` list lacks `ecr:*` but the deploy role's job is to `terraform apply` (which references the ECR repo URL as an input) AND push images to ECR before redeploying the task.
- **Issue:** Without `ecr:*`, GitHub Actions can't `docker push` to the ECR repo, which means the deploy pipeline can't ship a new container version even though it can apply infra changes.
- **Fix:** Added `ecr:*` to the `Action` list in `modules/iam/main.tf`. Phase 5 will tighten this (along with the rest of the policy) to per-repo / per-action allow-lists.
- **Files modified:** `infra/terraform/modules/iam/main.tf` (Task 1 commit).
- **Commit:** `430e17a`.

**4. [Rule 2 - Missing critical] `DenyInsecureTransport` on the APK bucket too (plan body has it only on recordings + feedback)**

- **Found during:** Reviewing the threat-model entry T-1.10-04 ("Insecure transport (HTTP) PUT bypasses TLS") — the mitigation says "DenyInsecureTransport on EVERY bucket". The plan body's HCL omits the policy resource for the APK bucket.
- **Issue:** The CloudFront viewer_protocol_policy=redirect-to-https handles user-facing reads, but if a future codepath uploads APK artifacts directly to the bucket via a manually-crafted presigned URL, there's no bucket-side TLS-only enforcement.
- **Fix:** Added the `aws_iam_policy_document.apk_policy` + `aws_s3_bucket_policy.apk` resources to the s3 module. Three buckets, three policies, all with the same DenyInsecureTransport statement.
- **Files modified:** `infra/terraform/modules/s3/main.tf` (Task 1 commit).
- **Commit:** `430e17a`.

**5. [Rule 2 - Missing critical] Explicit `name` on every inline `aws_iam_role_policy`**

- **Found during:** Reviewing how Terraform handles inline policies — without an explicit `name`, Terraform generates a random name with a stable-ish hash that nonetheless changes on resource recreation.
- **Issue:** Refactoring an inline policy (e.g. adding an action) without an explicit `name` triggers a destroy+create, which has a brief gap where the role has no policy attached → tasks fail to start.
- **Fix:** Added `name = "humyn-${var.env}-…"` to every `aws_iam_role_policy` resource (`ecs_execution_secrets`, `ecs_task_s3`, `github_deploy_terraform`).
- **Files modified:** `modules/ecs/main.tf` + `modules/iam/main.tf` (Task 1 + 2 commits).
- **Commits:** `430e17a` + `9e52db8`.

**6. [Rule 3 - Blocking gap] Documented the terraform-CLI-missing gap explicitly**

- **Found during:** Plan-level verification step (`terraform fmt -check` + `terraform validate`).
- **Issue:** Terraform CLI is not installed on this dev machine; orchestrator prompt forbids installing it; `tflint` not installed either. The plan-level verification commands cannot run.
- **Fix:** Did schema-only static checks instead (manual walk-through against AWS provider 5.x docs format, every grep acceptance criterion run, bash syntax check on the bootstrap script). Documented the gap explicitly in this Summary's "Static Verification" section AND in the Checkpoint Return below — the human runs `terraform fmt -check` and `terraform validate` at the apply gate as the canonical static-check pass.
- **Files modified:** None (this is a process-level deviation, not a code defect).
- **Commit:** N/A.

### Out-of-scope items deferred

- **Recordings playback CloudFront distribution.** Plan body doesn't request a CloudFront distribution for the recordings bucket — at MVP, plan 07 signs S3 presigned URLs directly via @aws-sdk/cloudfront-signer (the keypair shells live in the secrets module). A CloudFront-fronted recordings distribution is a Phase 5 follow-up.
- **Phase-5 IAM tightening of the GitHub deploy role.** The deploy-role policy is Phase-1-permissive (broad service:\_ actions). T-1.10-09 documents this; tightening to per-action / per-resource allow-lists with `aws:ResourceTag/Env=$env` conditions is a Phase-5 task.
- **Tighter container-secrets fetching.** ECS injects secrets at task start via the execution role; plan 07 (CloudFront playback) and other read-paths don't fetch secrets at runtime. If we ever do (e.g. rotating CloudFront keys without a task restart), we'd add a runtime IAM grant on the task role — out-of-scope at MVP.
- **`tflint` ruleset config (`.tflint.hcl`).** Not in the plan body. Plan 12 (CI) will set up the static-check pipeline; that's where `terraform fmt -check` + `terraform validate` + (optionally) `tflint` get added as PR gates.

### Out-of-scope discovery (deferred-items)

- **`CLAUDE.md` is dirty in `git status`** — same as plan 03, the file's been quietly modified since plan 01 last touched it. Not in plan 10's scope; left alone.

## Authentication Gates

**One pre-apply auth gate, not a deviation:** the human at the apply step needs an AWS CLI session authenticated against the humyn AWS org account. The Checkpoint Return below documents this as a precondition, not a blocker — it's the standard `terraform apply` workflow.

## Stub Tracking

- **`terraform.tfvars` `REPLACE_ME_*` values.** Both `envs/staging/terraform.tfvars` and `envs/prod/terraform.tfvars` ship with three placeholder values (`google_web_client_id`, `ecr_repo_url`, `acm_cert_arn`). These are **intentional stubs** — they must be populated with real values before the first apply. The README documents exactly where each value comes from. The human at the apply gate replaces them; `terraform plan` errors out cleanly if any remain (variable validation isn't in place since these are strings, but the AWS API call referencing them fails fast).
- **`humyn/cloudfront/signing-key` + `humyn/cloudfront/key-pair-id` Secrets Manager entries.** Created as empty Secrets Manager _shells_ by Terraform; the actual RSA-PEM content + key-pair-id are seeded out-of-band via `aws secretsmanager put-secret-value` post-apply. The README documents the openssl + create-public-key + put-secret-value sequence. **This is intentional, not a defect** — Terraform doesn't ship private RSA keys through state files (which would persist in the encrypted state bucket but isn't ideal regardless).
- **`humyn/jwt/signing-secret` + `humyn/gcp/play-integrity-sa-key`** — same pattern; shells provisioned, content seeded out-of-band via the README's snippets.

All three are explicitly documented in the README's "Secrets seeding (after first apply)" section.

## Threat Flags

No new threat surfaces beyond those already enumerated in the plan's `<threat_model>` (T-1.10-01..09). Specifically:

- The `default_tags` decoration adds `Env`, `ManagedBy`, `Project` tags but does NOT introduce new resources or trust boundaries.
- The `ecr:*` addition to the GitHub deploy role expands what CI can do but tightens NOTHING — Phase-5 tightening is still required (T-1.10-09 documents this).
- The bucket-policy `DenyInsecureTransport` on the APK bucket is additive defense — it doesn't add new attack surface, it removes a possible bypass that the threat model already mitigated at the CloudFront viewer_protocol_policy layer.

## Issues Encountered

- **Terraform CLI not installed on dev machine + orchestrator forbids installing it.** Worked around with manual schema review + grep-based acceptance-criteria checks + bash-syntax check on the bootstrap script. Documented the gap in the checkpoint return so the human at the apply gate runs `terraform fmt -check -recursive .` + `terraform validate` as their first step.
- **Plan body's `route { cidr_block = ...; gateway_id = ... }` syntax uses semicolons inside a single-line block.** That's not valid HCL (HCL uses newlines between attributes). Wrote the route blocks with proper newline-separated attributes and verified there are no stray semicolons in any non-comment / non-string position via `grep -rn ";" infra/terraform/`.
- **Plan body's prose summary says "two secrets at Phase 1" but the HCL lists three.** Trusted the HCL — three is correct (jwt + play-integrity + RDS master). Documented as Auto-fix #2 above.

## User Setup Required

**Two things the human needs before the first apply** (Task 4 / Checkpoint Reached):

1. AWS CLI session authenticated against the humyn org account (`aws sts get-caller-identity` returns the right identity) with permissions to create the state bucket + DynamoDB lock table (s3:CreateBucket, s3:PutBucketPolicy, s3:PutBucketVersioning, s3:PutBucketEncryption, s3:PutPublicAccessBlock, dynamodb:CreateTable).
2. Three pre-existing AWS resources (manually created in the AWS console — Terraform doesn't create these because they're once-off + need DNS validation flow + cross-account configuration):
   - **ACM certificate** in `ap-south-1` for `api.staging.humyn.ai` (and `api.humyn.ai` for prod) — DNS-validated.
   - **ECR repo** `humyn-api` in `ap-south-1`.
   - **(Already) the GitHub OIDC provider** — Terraform creates this, but if it already exists in the account from a prior project, the apply errors out and we need to import the existing provider into state first. Re-using one OIDC provider across multiple deploy roles is valid; the IAM module gracefully handles import.

## Next Phase Readiness

- **Plan 11 (build flavors / signing for distribution-recon)** — does not depend on Terraform infra; can run independently.
- **Plan 12 (e2e tests)** — references `apps/api` running in some environment. Once the apply gate passes and staging is up, plan 12 e2e can target the staging ALB DNS for production-parity tests.
- **Phase 2+ (subsequent api commits)** — every new feat needs a `docker build` + `docker push` + `terraform apply` (or just `aws ecs update-service --force-new-deployment` if the task-def family is unchanged). The GitHub OIDC role + ECR repo URL + task definition family are all in place to enable this.

## Self-Check: PASSED (autonomous portion)

All claims verified before pausing at the apply gate.

**Created files exist:**

- `infra/terraform/modules/network/{main,variables,outputs}.tf` — FOUND
- `infra/terraform/modules/rds/{main,variables,outputs}.tf` — FOUND
- `infra/terraform/modules/secrets/{main,outputs}.tf` — FOUND
- `infra/terraform/modules/s3/{main,variables,outputs}.tf` — FOUND
- `infra/terraform/modules/cloudfront/{main,variables,outputs}.tf` — FOUND
- `infra/terraform/modules/iam/{main,variables,outputs}.tf` — FOUND
- `infra/terraform/modules/ecs/{main,variables,outputs}.tf` — FOUND
- `infra/terraform/envs/staging/{main,variables,outputs,backend,terraform}.tf{,vars}` — FOUND
- `infra/terraform/envs/prod/{main,variables,outputs,backend,terraform}.tf{,vars}` — FOUND
- `infra/terraform/scripts/bootstrap-state-bucket.sh` — FOUND (mode 0755 verified)
- `infra/terraform/.gitignore` — FOUND
- `infra/terraform/README.md` — FOUND

**Commits exist (verified via `git log --oneline`):**

- `430e17a` — FOUND (Task 1)
- `9e52db8` — FOUND (Task 2)
- `ad93d17` — FOUND (Task 3)

**Plan-body grep-based acceptance criteria — all PASS:**

- `10.0.0.0/16` in network — PASS
- `from_port = 443` / `8080` / `5432` in network — PASS (with the 8080/5432 rules as separate `aws_security_group_rule` resources to dodge the SG-to-SG circular ref)
- `engine_version = "17.2"` + `shared_preload_libraries = "pg_stat_statements,vector"` in rds — PASS
- All four secret names (`humyn/jwt/signing-secret`, `humyn/gcp/play-integrity-sa-key`, `humyn/cloudfront/signing-key`, `humyn/cloudfront/key-pair-id`) in secrets — PASS
- `GLACIER_IR` + `DEEP_ARCHIVE` + `DenyUnencryptedPut` + `aws:SecureTransport` + `humyn-feedback` in s3 — PASS
- `us_east_1` + `redirect-to-https` in cloudfront — PASS
- `AssumeRoleWithWebIdentity` + `token.actions.githubusercontent.com` in iam — PASS
- `cpu = "512"` / `memory = "1024"` / `path = "/healthz"` / `JWT_SIGNING_SECRET` / `PLAY_INTEGRITY_SA_KEY_JSON` / `DATABASE_URL` / `FEEDBACK_BUCKET` / `AbortMultipartUpload` / `ELBSecurityPolicy-TLS13` / `desired_count = 1` in ecs — PASS
- `humyn-tf-state-staging` / `humyn-tf-state-prod` / `dynamodb_table = "humyn-tf-locks"` / `module "network"` / `module "ecs"` / `aws.us_east_1 = aws.us_east_1` in env compositions — PASS
- bootstrap script is +x; mentions `DynamoDB` + `put-bucket-versioning` — PASS
- `.gitignore` mentions `tfstate` — PASS
- README mentions `us-east-1` — PASS

**`terraform fmt -check` + `terraform validate` — DEFERRED to the apply gate** (terraform CLI not installed locally; orchestrator forbids installing it; documented gap in the Static Verification section + the Checkpoint Return).

## Checkpoint Reached

**Type:** human-verify
**Plan:** 01-10
**Progress:** 3 / 4 tasks complete (autonomous HCL authoring done; first apply against real AWS is the autonomous: false gate)

### What's been built

- 7 Terraform modules (network / rds / secrets / s3 / cloudfront / iam / ecs)
- 2 env compositions (staging + prod)
- State-bucket + DynamoDB lock bootstrap script
- VPC + RDS + Secrets + ECS + S3 + CloudFront + IAM definitions
- All 33 files committed in three atomic feat commits

### What needs human action — FIRST APPLY GATE

**Pre-apply prerequisites (run by the human, in this order):**

1. AWS CLI session authenticated against the humyn org account: `aws sts get-caller-identity`.
2. Manually create per-env prerequisites in the AWS console:
   - ACM certificate in `ap-south-1` for `api.staging.humyn.ai` (and `api.humyn.ai` for prod) — DNS validation. Grab the ARN.
   - ECR repo `humyn-api` in `ap-south-1`. Grab the repo URI.
3. Bootstrap the state bucket + DynamoDB lock:

   ```bash
   cd infra/terraform
   ./scripts/bootstrap-state-bucket.sh staging
   # (later, when ready for prod)
   ./scripts/bootstrap-state-bucket.sh prod
   ```

4. Populate `REPLACE_ME_*` values in `envs/staging/terraform.tfvars` (and later `envs/prod/terraform.tfvars`) with the values from steps 1+2 + Firebase Console (Google Web Client ID).

**Static-check pass (do this first; if anything fails, treat as Rule-1 fix-and-recommit):**

```bash
cd infra/terraform
terraform fmt -check -recursive .
cd envs/staging && terraform init -backend=false && terraform validate
cd ../prod && terraform init -backend=false && terraform validate
```

**Plan + review:**

```bash
cd infra/terraform/envs/staging
terraform init                           # first time only
terraform plan -out=staging.tfplan
terraform show staging.tfplan            # human-readable; READ THIS BEFORE APPLY
```

In `terraform show staging.tfplan`, confirm the resource counts match expectations:

- 1 VPC + 2 subnets + 1 IGW + 1 EIP + 1 NAT GW + 2 route tables + 2 route-table-associations
- 3 security groups + 2 separate `aws_security_group_rule` resources
- 1 RDS instance + 1 db_subnet_group + 1 db_parameter_group
- 4 Secrets Manager secrets (jwt, gcp, cloudfront/signing-key, cloudfront/key-pair-id)
- 1 ECS cluster + 1 CloudWatch log group + 2 IAM roles + 3 inline IAM policies + 1 IAM role-policy attachment + 1 task definition + 1 ALB + 1 target group + 1 HTTPS listener + 1 ECS service
- 3 S3 buckets + 3 public-access-block + 3 server-side-encryption + 2 lifecycle configs (recordings + feedback) + 3 bucket policies + 1 versioning resource (recordings)
- 1 ACM certificate (us-east-1) + 1 OAC + 1 CloudFront distribution
- 1 OIDC provider + 1 IAM role + 1 inline IAM policy

Roughly 50–55 resources for staging.

**Apply:**

```bash
terraform apply staging.tfplan
```

**Post-apply secret seeding:**

```bash
openssl rand -base64 32 | aws secretsmanager put-secret-value \
  --secret-id humyn/jwt/signing-secret --secret-string -

aws secretsmanager put-secret-value \
  --secret-id humyn/gcp/play-integrity-sa-key \
  --secret-string file://gcp-play-integrity-sa-key.json

# CloudFront keypair (for plan 07 API-09 playback URLs)
openssl genrsa -out cf-private.pem 2048
openssl rsa -in cf-private.pem -pubout -out cf-public.pem
aws cloudfront create-public-key \
  --public-key-config "Name=humyn-staging,EncodedKey=$(base64 < cf-public.pem),CallerReference=$(date +%s)"
# → note the public-key Id from the response
aws secretsmanager put-secret-value \
  --secret-id humyn/cloudfront/signing-key --secret-string file://cf-private.pem
aws secretsmanager put-secret-value \
  --secret-id humyn/cloudfront/key-pair-id \
  --secret-string '<key-pair-id-from-above>'
```

**Smoke verify:**

- ALB DNS name (from `terraform output alb_dns_name`) resolves and returns the AWS default 503 (no task running yet — expected; plans 12+ deploy a real image).
- Once an api image is pushed to ECR and the task is started, `curl -I https://<alb-dns>/healthz` returns 200.
- `aws s3 ls` shows `humyn-recordings-staging`, `humyn-apk-staging`, `humyn-feedback-staging`.
- `aws s3api get-bucket-lifecycle-configuration --bucket humyn-recordings-staging` returns the 7d→GLACIER_IR + 90d→DEEP_ARCHIVE + 1d-abort-multipart rule.
- `aws secretsmanager list-secrets --query 'SecretList[].Name'` shows all 4 `humyn/*` entries (excluding the auto-created RDS-managed master secret, which is also visible).

**Resume signal:** type "approved" once the plan applies cleanly and secrets are seeded. If a step fails, describe which step + the error — most failures (provider mismatch, validation error, region mismatch) are Rule-1 fix-and-recommit.

## Authentication Gate (post-apply)

After the human approves and the plan-metadata commit lands:

- **STATE.md** advances to plan 11 of 13 (handled by the orchestrator on resume).
- **ROADMAP.md** plan-progress for phase 1 ticks up from 9 / 13 → 10 / 13.
- **REQUIREMENTS.md** — `API-17`, `DIST-01`, `LEGAL-05` move from open to closed (LEGAL-05 was already closed by plan 03 in dev; this closes the prod-parity claim).

Until then, the plan is **status: partial-pending-checkpoint** — no STATE.md / ROADMAP / REQUIREMENTS markings change. (See "STATE updates deferred" section below for the rationale.)

## STATE updates deferred until apply gate

Per the orchestrator prompt:

> STATE.md updated; ROADMAP plan progress NOT marked complete until user approves the apply gate

For this plan, that means: I update STATE.md's session-continuity (last_updated, stopped_at) so the orchestrator knows where to resume, but I do NOT advance the Current Plan counter from 9→10, and I do NOT mark requirements as closed. The plan-metadata commit (this SUMMARY.md + STATE.md changes) lands ALONGSIDE the resume from the apply gate, not before it.

---

_Phase: 01-foundation-backend-distribution-recon_
_Status: partial-pending-checkpoint (Task 4 = first terraform apply against real AWS staging)_
_Tasks committed: 3 / 4 (430e17a, 9e52db8, ad93d17)_
_Generated: 2026-05-07_
