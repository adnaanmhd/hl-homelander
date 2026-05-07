#!/usr/bin/env bash
set -euo pipefail

# LocalStack injects awslocal at /usr/bin/awslocal — same args as `aws` but
# pre-targeted at http://localhost:4566.
echo "[init] Creating S3 buckets ..."

awslocal s3api create-bucket \
  --bucket humyn-recordings-dev \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1 || true

awslocal s3api create-bucket \
  --bucket humyn-apk-dev \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1 || true

# humyn-feedback-dev — diagnostic-attachment bucket for POST /feedback (plan 01-08)
awslocal s3api create-bucket \
  --bucket humyn-feedback-dev \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1 || true

awslocal s3api put-public-access-block \
  --bucket humyn-feedback-dev \
  --public-access-block-configuration \
    "BlockPublicAcls=true,BlockPublicPolicy=true,IgnorePublicAcls=true,RestrictPublicBuckets=true"

# 90-day expiration on feedback bucket — diagnostic snapshots are short-lived support data
awslocal s3api put-bucket-lifecycle-configuration \
  --bucket humyn-feedback-dev \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "expire-old-feedback",
        "Status": "Enabled",
        "Filter": {"Prefix": ""},
        "Expiration": {"Days": 90}
      }
    ]
  }'

# Versioning on the recordings bucket (matches RESEARCH §3.6)
awslocal s3api put-bucket-versioning \
  --bucket humyn-recordings-dev \
  --versioning-configuration Status=Enabled

# Public access block on both
for bucket in humyn-recordings-dev humyn-apk-dev; do
  awslocal s3api put-public-access-block \
    --bucket "$bucket" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,BlockPublicPolicy=true,IgnorePublicAcls=true,RestrictPublicBuckets=true"
done

# Day-zero lifecycle on recordings bucket — LEGAL-05 / RESEARCH §3.6.
# Glacier IR at +7 days, Deep Archive at +90 days. Storage-class transitions
# only — no transcoding.
echo "[init] Applying recordings lifecycle (Glacier IR @ +7d, Deep Archive @ +90d) ..."

awslocal s3api put-bucket-lifecycle-configuration \
  --bucket humyn-recordings-dev \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "tier-down",
        "Status": "Enabled",
        "Filter": {"Prefix": ""},
        "Transitions": [
          {"Days": 7,  "StorageClass": "GLACIER_IR"},
          {"Days": 90, "StorageClass": "DEEP_ARCHIVE"}
        ],
        "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1}
      }
    ]
  }'

# CORS on recordings bucket so dev mobile clients (when wired in plan 13)
# can PUT directly with presigned URLs.
awslocal s3api put-bucket-cors \
  --bucket humyn-recordings-dev \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }]
  }'

echo "[init] Bucket setup complete."
awslocal s3 ls
awslocal s3api get-bucket-lifecycle-configuration --bucket humyn-recordings-dev
