variable "env" {
  description = "Deployment environment"
  type        = string
}

variable "vpc_id" {
  description = "VPC id — the Redis security group lives here"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet ids — the ElastiCache subnet group spans these"
  type        = list(string)
}

variable "source_security_group_ids" {
  description = "Security group ids allowed to reach Redis on 6379 (the Fargate SG — API + worker tasks)"
  type        = list(string)
}

variable "node_type" {
  description = "ElastiCache node type — cache.t4g.micro at MVP (single node, BullMQ only)"
  type        = string
  default     = "cache.t4g.micro"
}

variable "tags" {
  description = "Extra tags merged onto every resource"
  type        = map(string)
  default     = {}
}
