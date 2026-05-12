# redis — the single Redis carve-out at MVP (CLAUDE.md): the BullMQ hash-verify
# queue lives here. A single-node ElastiCache Redis 7 cluster (cache.t4g.micro);
# the on-device upload queue is MMKV-backed, not here. Reached over the VPC
# (the security group, ingress 6379 from the Fargate SG only) — no IAM.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

locals {
  base_tags = merge({ Env = var.env, ManagedBy = "terraform", Component = "redis" }, var.tags)
}

resource "aws_security_group" "redis" {
  name        = "humyn-${var.env}-redis"
  description = "ElastiCache Redis — ingress 6379 from the Fargate SG only"
  vpc_id      = var.vpc_id
  tags        = local.base_tags
}

resource "aws_security_group_rule" "redis_ingress" {
  count                    = length(var.source_security_group_ids)
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.redis.id
  source_security_group_id = var.source_security_group_ids[count.index]
  description              = "Redis from a workload security group"
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "humyn-${var.env}-redis"
  subnet_ids = var.private_subnet_ids
  tags       = local.base_tags
}

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "humyn-${var.env}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  tags                 = local.base_tags
}
