output "alb_dns_name" {
  description = "ALB DNS name — DNS CNAME target for api.staging.humyn.ai"
  value       = module.ecs.alb_dns_name
}

output "rds_endpoint" {
  description = "RDS endpoint (host:port) — debugging only; ECS task uses DATABASE_URL secret directly"
  value       = module.rds.endpoint
}

output "apk_distribution_domain" {
  description = "CloudFront domain name for apk.humyn.ai (CNAME target)"
  value       = module.cloudfront.apk_distribution_domain
}

output "apk_distribution_id" {
  description = "CloudFront distribution ID — used for cache invalidation by GitHub Actions"
  value       = module.cloudfront.apk_distribution_id
}

output "github_deploy_role_arn" {
  description = "Role ARN to paste into the `role-to-assume` input of aws-actions/configure-aws-credentials"
  value       = module.iam.github_deploy_role_arn
}

output "recordings_bucket_name" {
  description = "Name of humyn-recordings-staging"
  value       = module.s3.recordings_bucket_name
}

output "feedback_bucket_name" {
  description = "Name of humyn-feedback-staging"
  value       = module.s3.feedback_bucket_name
}
