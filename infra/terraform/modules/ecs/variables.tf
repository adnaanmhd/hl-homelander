variable "env" {
  description = "Deployment environment: staging | prod"
  type        = string
}

variable "region" {
  description = "AWS region for compute (D-HOST-01: ap-south-1)"
  type        = string
}

# ── Network wiring (from network module) ─────────────────────────────────

variable "vpc_id" {
  description = "VPC ID — for the ALB target group"
  type        = string
}

variable "public_subnet_id" {
  description = "Public subnet ID — ALB lives here"
  type        = string
}

variable "private_subnet_id" {
  description = "Private subnet ID — Fargate tasks live here"
  type        = string
}

variable "sg_alb_id" {
  description = "ALB security group"
  type        = string
}

variable "sg_fargate_id" {
  description = "Fargate task security group"
  type        = string
}

# ── Container image + runtime config ─────────────────────────────────────

variable "ecr_repo_url" {
  description = "Full ECR repo URL for the api image (e.g. 123456789012.dkr.ecr.ap-south-1.amazonaws.com/humyn-api)"
  type        = string
}

variable "image_tag" {
  description = "Container image tag — set by CI on each deploy"
  type        = string
  default     = "latest"
}

variable "google_web_client_id" {
  description = "Google Sign-In Web Client ID (Firebase Console → Project Settings → Cloud Messaging)"
  type        = string
}

# ── Buckets (from s3 module) ─────────────────────────────────────────────

variable "recordings_bucket_name" {
  description = "Name of humyn-recordings-${env} bucket — passed as RECORDINGS_BUCKET env var"
  type        = string
}

variable "recordings_bucket_arn" {
  description = "ARN of humyn-recordings-${env} bucket — used in task-role policy"
  type        = string
}

variable "apk_bucket_name" {
  description = "Name of humyn-apk-${env} bucket — passed as APK_BUCKET env var"
  type        = string
}

variable "apk_bucket_arn" {
  description = "ARN of humyn-apk-${env} bucket — used in task-role policy"
  type        = string
}

variable "feedback_bucket_name" {
  description = "Name of humyn-feedback-${env} bucket — passed as FEEDBACK_BUCKET env var"
  type        = string
}

variable "feedback_bucket_arn" {
  description = "ARN of humyn-feedback-${env} bucket — used in task-role policy"
  type        = string
}

# ── Secrets (from secrets + rds modules) ─────────────────────────────────

variable "jwt_secret_arn" {
  description = "ARN of humyn/jwt/signing-secret — execution role + container secret"
  type        = string
}

variable "gcp_sa_secret_arn" {
  description = "ARN of humyn/gcp/play-integrity-sa-key — execution role + container secret"
  type        = string
}

variable "rds_master_secret_arn" {
  description = "ARN of the RDS-managed master secret — execution role + container secret (DATABASE_URL via :url:: extraction)"
  type        = string
}

# ── ALB cert ─────────────────────────────────────────────────────────────

variable "acm_cert_arn" {
  description = "ARN of the ap-south-1 ACM cert for api.<env>.humyn.ai (bootstrapped manually before first apply)"
  type        = string
}
