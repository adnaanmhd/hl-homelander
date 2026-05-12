output "verify_queue_url" {
  description = "URL of the verify SQS queue (set as VERIFY_QUEUE_URL on the sqs-poller container)"
  value       = aws_sqs_queue.verify.id
}

output "verify_queue_arn" {
  description = "ARN of the verify SQS queue"
  value       = aws_sqs_queue.verify.arn
}

output "verify_dlq_arn" {
  description = "ARN of the verify dead-letter queue"
  value       = aws_sqs_queue.verify_dlq.arn
}

output "worker_task_definition_arn" {
  description = "ARN of the humyn-worker ECS task definition (hash-verify + sqs-poller containers)"
  value       = aws_ecs_task_definition.worker.arn
}

output "worker_service_name" {
  description = "Name of the worker ECS service"
  value       = aws_ecs_service.worker.name
}

output "worker_task_role_arn" {
  description = "ARN of the worker task role (s3:GetObject read-only + sqs receive/delete)"
  value       = aws_iam_role.worker_task_role.arn
}
