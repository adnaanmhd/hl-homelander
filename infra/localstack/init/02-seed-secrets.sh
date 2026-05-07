#!/usr/bin/env bash
set -euo pipefail

echo "[init] Seeding Secrets Manager entries ..."

# JWT signing secret — dev-only value. ECS injects the prod value from
# AWS Secrets Manager at task start (see RESEARCH §3.5).
awslocal secretsmanager create-secret \
  --name humyn/jwt/signing-secret \
  --description "HS256 256-bit signing secret per D-AUTH-04 — DEV ONLY" \
  --secret-string "dev-only-do-not-use-in-prod-ee2c5b8c1a4f3d6e9c0b7a1d8e3f5b2a" \
  || awslocal secretsmanager put-secret-value \
       --secret-id humyn/jwt/signing-secret \
       --secret-string "dev-only-do-not-use-in-prod-ee2c5b8c1a4f3d6e9c0b7a1d8e3f5b2a"

# GCP service-account JSON for Play Integrity — placeholder for dev.
# Real value in prod: see RESEARCH §3.4. Dev loads a stub that the auth
# code skips when GOOGLE_WEB_CLIENT_ID is empty.
awslocal secretsmanager create-secret \
  --name humyn/gcp/play-integrity-sa-key \
  --description "GCP service account JSON for Play Integrity — DEV STUB" \
  --secret-string '{"type":"service_account","project_id":"dev-stub","private_key":"DEV_STUB","client_email":"dev-stub@dev-stub.iam.gserviceaccount.com"}' \
  || awslocal secretsmanager put-secret-value \
       --secret-id humyn/gcp/play-integrity-sa-key \
       --secret-string '{"type":"service_account","project_id":"dev-stub","private_key":"DEV_STUB","client_email":"dev-stub@dev-stub.iam.gserviceaccount.com"}'

# CloudFront signing keypair (dev parity for plan 07's /recordings/:id playback flow).
# Generates a fresh RSA-2048 keypair on every dev-up; the signed URL won't actually
# verify against LocalStack S3 (LocalStack does not implement CloudFront URL verification),
# but minting the URL exercises the @aws-sdk/cloudfront-signer code path. Real prod
# values are seeded by plan 10's Terraform out-of-band script per the secret comment block.
echo "[init] Generating dev CloudFront RSA-2048 keypair ..."
CF_PRIVATE_PEM=$(openssl genrsa 2048 2>/dev/null)
CF_KEY_PAIR_ID="K-DEV-LOCALSTACK-$(date +%s)"

awslocal secretsmanager create-secret \
  --name humyn/cloudfront/signing-key \
  --description "CloudFront signing private key (RSA PEM) — DEV STUB regenerated per dev-up" \
  --secret-string "$CF_PRIVATE_PEM" \
  || awslocal secretsmanager put-secret-value \
       --secret-id humyn/cloudfront/signing-key \
       --secret-string "$CF_PRIVATE_PEM"

awslocal secretsmanager create-secret \
  --name humyn/cloudfront/key-pair-id \
  --description "CloudFront key-pair-id paired with the dev signing key" \
  --secret-string "$CF_KEY_PAIR_ID" \
  || awslocal secretsmanager put-secret-value \
       --secret-id humyn/cloudfront/key-pair-id \
       --secret-string "$CF_KEY_PAIR_ID"

echo "[init] Secrets seeded."
awslocal secretsmanager list-secrets --query 'SecretList[].Name'
