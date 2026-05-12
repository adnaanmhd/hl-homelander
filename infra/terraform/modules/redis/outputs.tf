output "endpoint" {
  description = "Redis connection URL — pass as REDIS_URL to the worker (and the API if it needs the queue)"
  value       = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:${aws_elasticache_cluster.main.cache_nodes[0].port}"
}

output "host" {
  description = "Redis primary node hostname"
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "security_group_id" {
  description = "ARN/id of the Redis security group"
  value       = aws_security_group.redis.id
}
