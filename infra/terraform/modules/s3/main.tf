# S3 module — three buckets:
#
#   humyn-recordings-${env}  — uploaded MP4 + IMU CSV + metadata JSON. Versioned.
#                              Day-zero lifecycle (LEGAL-05) tier-down to
#                              GLACIER_IR @ +7d, DEEP_ARCHIVE @ +90d. Files travel
#                              byte-for-byte (CLAUDE.md file-fidelity rule) — only
#                              storage-class transitions, never transcoding.
#
#   humyn-apk-${env}         — APK artifacts. Public via CloudFront only
#                              (block all direct public access at the bucket).
#
#   humyn-feedback-${env}    — diagnostic snapshots from /feedback (plan 08).
#                              90-day expiration; not part of the LEGAL-05 dataset.
#
# Bucket-policy hard rules (RESEARCH §3.6 + threat-model T-1.10-03/04):
#   1. Deny PUTs without `s3:x-amz-server-side-encryption=AES256`.
#   2. Deny any request where `aws:SecureTransport=false` (TLS-only).

# ── Recordings bucket ──────────────────────────────────────────────────────

resource "aws_s3_bucket" "recordings" {
  bucket = "humyn-recordings-${var.env}"

  tags = {
    Env     = var.env
    Purpose = "recordings"
  }
}

resource "aws_s3_bucket_versioning" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Day-zero lifecycle — Glacier IR @ +7d, Deep Archive @ +90d. Storage-class
# transitions only — files travel byte-for-byte (CLAUDE.md file-fidelity rule).
resource "aws_s3_bucket_lifecycle_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    id     = "tier-down"
    status = "Enabled"

    filter {}

    transition {
      days          = 7
      storage_class = "GLACIER_IR"
    }

    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# Bucket policy — deny unencrypted PUT + deny insecure transport.
data "aws_iam_policy_document" "recordings_policy" {
  statement {
    sid     = "DenyUnencryptedPut"
    effect  = "Deny"
    actions = ["s3:PutObject"]

    resources = ["${aws_s3_bucket.recordings.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "StringNotEquals"
      variable = "s3:x-amz-server-side-encryption"
      values   = ["AES256"]
    }
  }

  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.recordings.arn,
      "${aws_s3_bucket.recordings.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "recordings" {
  bucket = aws_s3_bucket.recordings.id
  policy = data.aws_iam_policy_document.recordings_policy.json

  depends_on = [aws_s3_bucket_public_access_block.recordings]
}

# ── APK bucket — public via CloudFront only ────────────────────────────────

resource "aws_s3_bucket" "apk" {
  bucket = "humyn-apk-${var.env}"

  tags = {
    Env     = var.env
    Purpose = "apk"
  }
}

resource "aws_s3_bucket_public_access_block" "apk" {
  bucket = aws_s3_bucket.apk.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "apk" {
  bucket = aws_s3_bucket.apk.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# TLS-only enforcement on the APK bucket too. CloudFront's
# `viewer_protocol_policy=redirect-to-https` is the user-facing layer; this
# is the bucket-side belt-and-braces.
data "aws_iam_policy_document" "apk_policy" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.apk.arn,
      "${aws_s3_bucket.apk.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "apk" {
  bucket = aws_s3_bucket.apk.id
  policy = data.aws_iam_policy_document.apk_policy.json

  depends_on = [aws_s3_bucket_public_access_block.apk]
}

# ── Feedback bucket — diagnostic snapshots (plan 08) ───────────────────────

resource "aws_s3_bucket" "feedback" {
  bucket = "humyn-feedback-${var.env}"

  tags = {
    Env     = var.env
    Purpose = "feedback"
  }
}

resource "aws_s3_bucket_public_access_block" "feedback" {
  bucket = aws_s3_bucket.feedback.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "feedback" {
  bucket = aws_s3_bucket.feedback.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "feedback" {
  bucket = aws_s3_bucket.feedback.id

  rule {
    id     = "expire-old-feedback"
    status = "Enabled"

    filter {}

    expiration {
      days = 90
    }
  }
}

data "aws_iam_policy_document" "feedback_policy" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.feedback.arn,
      "${aws_s3_bucket.feedback.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "feedback" {
  bucket = aws_s3_bucket.feedback.id
  policy = data.aws_iam_policy_document.feedback_policy.json

  depends_on = [aws_s3_bucket_public_access_block.feedback]
}
