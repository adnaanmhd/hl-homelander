output "alb_dns_name" {
  description = "ALB DNS name — DNS CNAME target for api.<env>.humyn.ai"
  value       = aws_lb.api.dns_name
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role (runtime container permissions)"
  value       = aws_iam_role.ecs_task.arn
}

output "ecs_execution_role_arn" {
  description = "ARN of the ECS execution role (image pulls, secrets, logs)"
  value       = aws_iam_role.ecs_execution.arn
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for the api container"
  value       = aws_cloudwatch_log_group.api.name
}
