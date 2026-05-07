#!/usr/bin/env bash
#
# bootstrap-state-bucket.sh — manual one-time bootstrap of the Terraform
# remote-state S3 bucket + DynamoDB lock table for an env.
#
# Usage:
#   ./scripts/bootstrap-state-bucket.sh staging
#   ./scripts/bootstrap-state-bucket.sh prod
#
# Requires:
#   - aws CLI authenticated as a principal with s3:* + dynamodb:* permissions
#     in the target account
#   - REGION env var (default ap-south-1) matches what backend.tf declares
#
# Idempotent: re-running against an already-bootstrapped env is a no-op.
#
# What it creates:
#   1. S3 bucket `humyn-tf-state-${env}` — encrypted (AES256), versioned
#      (so a corrupted state file can be rolled back), public-access blocked.
#   2. DynamoDB table `humyn-tf-locks` — shared across envs (LockID is the
#      partition key; per-state-key entries don't collide).

set -euo pipefail

ENV="${1:-staging}"
REGION="${REGION:-ap-south-1}"
BUCKET="humyn-tf-state-${ENV}"
LOCK_TABLE="humyn-tf-locks"

if [[ "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "[bootstrap] ERROR: env must be 'staging' or 'prod' (got '$ENV')" >&2
  exit 1
fi

echo "[bootstrap] Creating Terraform state bucket and DynamoDB lock for env=${ENV} region=${REGION} ..."

# 1. Create state bucket (idempotent — head-bucket exits 0 if already exists)
if aws s3api head-bucket --bucket "$BUCKET" --region "$REGION" 2>/dev/null; then
  echo "[bootstrap] State bucket ${BUCKET} already exists — skipping create"
else
  aws s3api create-bucket \
    --bucket "$BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration "LocationConstraint=${REGION}"
  echo "[bootstrap] Created state bucket ${BUCKET}"
fi

# Encryption (AES256 default)
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Versioning — corrupted state file → rollback to prior version
aws s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration "Status=Enabled"

# Block all public access
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration "BlockPublicAcls=true,BlockPublicPolicy=true,IgnorePublicAcls=true,RestrictPublicBuckets=true"

# 2. Create DynamoDB lock table — shared across envs
if aws dynamodb describe-table --table-name "$LOCK_TABLE" --region "$REGION" >/dev/null 2>&1; then
  echo "[bootstrap] DynamoDB lock table ${LOCK_TABLE} already exists — skipping create"
else
  aws dynamodb create-table \
    --table-name "$LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
  echo "[bootstrap] Created DynamoDB lock table ${LOCK_TABLE}"
fi

echo "[bootstrap] Done. State bucket=${BUCKET} Lock=${LOCK_TABLE} Region=${REGION}"
echo "[bootstrap] Next: cd infra/terraform/envs/${ENV} && terraform init"
