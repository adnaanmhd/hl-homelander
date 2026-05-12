variable "env" {
  description = "Deployment environment (prod at MVP — the hash-verify pipeline is prod-only; dev uses docker-compose + the /finalize LocalStack shim)"
  type        = string
}

variable "region" {
  description = "AWS region for compute + the queue (D-HOST-01: ap-south-1)"
  type        = string
}

# ── Recordings bucket (from the s3 module) ────────────────────────────────

variable "recordings_bucket_name" {
  description = "Name/id of humyn-recordings-${env} — the EventBridge rule filters on it; the bucket's notification config is set to eventbridge=true here"
  type        = string
}

variable "recordings_bucket_arn" {
  description = "ARN of humyn-recordings-${env} — the worker task role gets s3:GetObject on ${arn}/* (READ-ONLY)"
  type        = string
}

# ── ECS / VPC wiring (from network + ecs modules) ─────────────────────────

variable "ecs_cluster_arn" {
  description = "ARN of the Fargate cluster — the worker service joins it"
  type        = string
}

variable "ecs_cluster_name" {
  description = "Name of the Fargate cluster — used for the autoscaling target resource_id and the RunningTaskCount metric dimension"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet ids — the worker tasks live here (no public IP; queue consumer, no inbound)"
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group ids for the worker tasks (egress to S3/SQS/RDS/Redis)"
  type        = list(string)
}

# ── Container image + runtime config ──────────────────────────────────────

variable "worker_image" {
  description = "Full container image ref (same image as the API; the worker is a different entrypoint: node dist/workers/hash-verify.js)"
  type        = string
}

variable "redis_endpoint" {
  description = "Redis connection URL (the ElastiCache endpoint) — passed as REDIS_URL to the worker; BullMQ lives here"
  type        = string
}

variable "db_secret_arn" {
  description = "ARN of the RDS-managed master secret — DATABASE_URL via the :url:: JSON-key extraction (same pattern as the API task)"
  type        = string
}

# ── Autoscaling bounds (VERIFY-07) ────────────────────────────────────────

variable "min_tasks" {
  description = "Minimum worker task count — 0 = scale-from-zero on queue backlog"
  type        = number
  default     = 0
}

variable "max_tasks" {
  description = "Maximum worker task count"
  type        = number
  default     = 4
}

variable "backlog_target_per_task" {
  description = "Target backlog-per-task (SQS ApproximateNumberOfMessages ÷ running tasks) the autoscaler tracks"
  type        = number
  default     = 5
}

variable "tags" {
  description = "Extra tags merged onto every resource"
  type        = map(string)
  default     = {}
}
