output "endpoint" {
  description = "RDS endpoint host:port — debugging only; ECS uses DATABASE_URL secret directly"
  value       = aws_db_instance.main.endpoint
}

output "rds_master_secret_arn" {
  description = "ARN of the Secrets Manager secret managing master credentials (key `url` is consumed by ECS)"
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}
