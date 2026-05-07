variable "env" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
}

variable "region" {
  description = "AWS region for compute + storage (D-HOST-01: ap-south-1)"
  type        = string
  default     = "ap-south-1"
}

variable "google_web_client_id" {
  description = "Google Sign-In Web Client ID (Firebase Console → Project Settings → Cloud Messaging)"
  type        = string
}

variable "ecr_repo_url" {
  description = "Full ECR repo URL for the api image (bootstrapped manually before first apply)"
  type        = string
}

variable "image_tag" {
  description = "Container image tag — bumped by CI on each deploy"
  type        = string
  default     = "latest"
}

variable "github_owner" {
  description = "GitHub org/user that owns the repo (used in OIDC sub claim)"
  type        = string
}

variable "github_repo" {
  description = "GitHub repo name (used in OIDC sub claim)"
  type        = string
}

variable "acm_cert_arn" {
  description = "ARN of the ap-south-1 ACM cert for api.staging.humyn.ai (bootstrapped manually before first apply)"
  type        = string
}
