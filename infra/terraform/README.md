# Humyn Labs Capture — AWS Infrastructure

Terraform 1.10+ definitions for the Phase 1 AWS production footprint.

- **Region:** `ap-south-1` (Mumbai) per D-HOST-01
- **CloudFront ACM cert:** `us-east-1` — hard CloudFront constraint, surfaced via the aliased `aws.us_east_1` provider
- **Single-AZ at MVP** per D-HOST-02; designed for clean additive multi-AZ later
- **State backend:** S3 (encrypted + versioned) + DynamoDB lock — bootstrapped manually once per env

## Directory layout

```
infra/terraform/
├── modules/
│   ├── network/         # VPC, subnets, IGW, NAT GW, 3 SGs (alb / fargate / rds)
│   ├── rds/             # Postgres 17 + pgvector, single-AZ, GP3 storage
│   ├── secrets/         # Secrets Manager entries (jwt, gcp, cloudfront x2)
│   ├── ecs/             # Fargate cluster + task def + ALB + scoped IAM roles
│   ├── s3/              # Recordings + APK + Feedback buckets with lifecycle
│   ├── cloudfront/      # APK distribution + us-east-1 ACM cert
│   └── iam/             # GitHub Actions OIDC trust + scoped deploy role
├── envs/
│   ├── staging/         # Staging composition — module wiring + tfvars + backend
│   └── prod/            # Prod composition — same shape, bigger RDS class
├── scripts/
│   └── bootstrap-state-bucket.sh   # Run once per env before first init
└── .gitignore           # Excludes tfstate, .terraform/, *.tfplan, etc.
```

## One-time bootstrap (per env)

```bash
# Authenticate the AWS CLI as a principal with s3:* + dynamodb:* perms
aws sts get-caller-identity   # confirm you're in the humyn org account

# 1. Create the state bucket + DynamoDB lock table
./scripts/bootstrap-state-bucket.sh staging
./scripts/bootstrap-state-bucket.sh prod

# 2. Manually create per-env prerequisites in the AWS console:
#    a. ACM cert in ap-south-1 for api.staging.humyn.ai (DNS-validated)
#       → grab the ARN; paste into envs/staging/terraform.tfvars
#    b. Same for api.humyn.ai in prod
#    c. ECR repo `humyn-api` (region ap-south-1)
#       → grab the repo URI; paste into both staging + prod tfvars

# 3. Populate REPLACE_ME values in:
#    envs/staging/terraform.tfvars
#    envs/prod/terraform.tfvars

# 4. Initialize the backend
cd envs/staging
terraform init
```

## Daily workflow

```bash
cd infra/terraform/envs/staging   # or envs/prod

# Static checks (fast, no AWS calls)
terraform fmt -check -recursive ../..
terraform validate                 # `init -backend=false` is enough for this

# Plan + review + apply
terraform init                     # only first time, or after backend changes
terraform plan -out=tfplan
terraform show tfplan              # human-readable; READ THIS BEFORE APPLY
terraform apply tfplan
```

## Region split

- **All compute + storage:** `ap-south-1` (Mumbai)
- **CloudFront ACM certificate:** `us-east-1` — non-negotiable CloudFront constraint
- **Brazilian users:** TLS terminates at the nearest CloudFront POP (São Paulo) and proxies to Mumbai. Multi-region deferred per CONTEXT.md "Deferred Ideas".

## Secrets seeding (after first apply)

Terraform creates the Secrets Manager _shells_. Initial values are put in via the AWS CLI out-of-band:

```bash
# 1. JWT signing secret (HS256, 256 bits)
openssl rand -base64 32 | aws secretsmanager put-secret-value \
  --secret-id humyn/jwt/signing-secret --secret-string -

# 2. GCP service-account JSON for Play Integrity decodeIntegrityToken
aws secretsmanager put-secret-value \
  --secret-id humyn/gcp/play-integrity-sa-key \
  --secret-string file://gcp-play-integrity-sa-key.json

# 3. CloudFront signing keypair (per /recordings/:id playback URLs, API-09)
openssl genrsa -out cf-private.pem 2048
openssl rsa -in cf-private.pem -pubout -out cf-public.pem

aws cloudfront create-public-key \
  --public-key-config "Name=humyn-prod,EncodedKey=$(base64 < cf-public.pem),CallerReference=$(date +%s)"
# → note the public-key Id from the response

aws secretsmanager put-secret-value \
  --secret-id humyn/cloudfront/signing-key --secret-string file://cf-private.pem
aws secretsmanager put-secret-value \
  --secret-id humyn/cloudfront/key-pair-id \
  --secret-string '<key-pair-id-from-above>'
```

## Modules at a glance

| Module     | What it provisions                                                                 |
| ---------- | ---------------------------------------------------------------------------------- |
| network    | VPC `10.0.0.0/16` + public + private subnet (single AZ) + IGW + NAT GW + 3 SGs     |
| rds        | RDS Postgres 17.2 + pgvector parameter group, `db.t4g.medium` staging / large prod |
| secrets    | 4 Secrets Manager entries — jwt, gcp, cloudfront signing key + key-pair-id         |
| ecs        | Fargate cluster + task def + ALB + execution + task IAM roles (scoped per §3.8)    |
| s3         | 3 buckets — recordings (versioned + LEGAL-05 lifecycle) + apk + feedback (90d)     |
| cloudfront | APK distribution + us-east-1 ACM cert + OAC                                        |
| iam        | GitHub OIDC provider + `humyn-${env}-github-deploy` role (trust scoped to repo)    |

## Hard rules (do not violate without re-reading CLAUDE.md)

- **Files travel byte-for-byte from device to S3 to Glacier.** S3 lifecycle is storage-class transitions only — no transcoding (LEGAL-05).
- **No `*:*` IAM policies** on the task or execution role. Bucket scope is per-prefix, secret scope is per-ARN. The GitHub deploy role is the only role with broad permissions, and its trust is locked to `repo:${owner}/${repo}:*` via OIDC sub claim.
- **Bucket policies enforce two invariants:** (1) PUTs without `s3:x-amz-server-side-encryption=AES256` are denied; (2) any request with `aws:SecureTransport=false` is denied.
- **Single-AZ at MVP.** Multi-AZ is an additive change later (`multi_az = true` on RDS, plus extra subnets in the network module). Do not redesign the schema for it.

## First-apply gate (autonomous: false)

The first `terraform apply` against staging is a human-in-the-loop step (see plan `01-10-PLAN.md` Task 4 — `checkpoint:human-verify`). The autonomous CI checks (`terraform fmt -check` + `terraform validate`) run on every push; the apply runs only after a human inspects `terraform plan` output and explicitly approves.
