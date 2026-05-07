variable "env" {
  description = "Deployment environment: staging | prod"
  type        = string
}

variable "region" {
  description = "AWS region for compute + storage (D-HOST-01: ap-south-1)"
  type        = string
  default     = "ap-south-1"
}
