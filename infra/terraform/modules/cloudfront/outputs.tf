output "apk_distribution_id" {
  description = "CloudFront distribution ID — used by GitHub Actions for cache invalidation after APK upload"
  value       = aws_cloudfront_distribution.apk.id
}

output "apk_distribution_domain" {
  description = "CloudFront distribution domain name (e.g. d111111abcdef8.cloudfront.net) — DNS CNAME target for apk.humyn.ai"
  value       = aws_cloudfront_distribution.apk.domain_name
}

output "apk_acm_certificate_arn" {
  description = "ARN of the us-east-1 ACM certificate for apk.humyn.ai (debugging only)"
  value       = aws_acm_certificate.apk.arn
}
