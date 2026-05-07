output "github_deploy_role_arn" {
  description = "ARN of the GitHub Actions deploy role — paste into the `role-to-assume` input of aws-actions/configure-aws-credentials"
  value       = aws_iam_role.github_deploy.arn
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider (re-usable across roles)"
  value       = aws_iam_openid_connect_provider.github.arn
}
