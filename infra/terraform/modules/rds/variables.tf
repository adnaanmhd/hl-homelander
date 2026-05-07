variable "env" {
  description = "Deployment environment: staging | prod"
  type        = string
}

variable "private_subnet_id" {
  description = "Private subnet ID (from network module) where the RDS instance lives"
  type        = string
}

variable "sg_rds_id" {
  description = "Security group ID (from network module) attached to the RDS instance"
  type        = string
}

variable "instance_class" {
  description = "RDS instance class — db.t4g.medium at MVP staging, db.t4g.large in prod"
  type        = string
  default     = "db.t4g.medium"
}

variable "allocated_storage_gb" {
  description = "GP3 allocated storage in GiB"
  type        = number
  default     = 100
}
