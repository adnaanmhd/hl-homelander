output "recordings_bucket_arn" {
  description = "ARN of humyn-recordings-${var.env}"
  value       = aws_s3_bucket.recordings.arn
}

output "recordings_bucket_name" {
  description = "Name of humyn-recordings-${var.env}"
  value       = aws_s3_bucket.recordings.id
}

output "apk_bucket_arn" {
  description = "ARN of humyn-apk-${var.env}"
  value       = aws_s3_bucket.apk.arn
}

output "apk_bucket_name" {
  description = "Name of humyn-apk-${var.env}"
  value       = aws_s3_bucket.apk.id
}

output "apk_bucket_regional_domain" {
  description = "Regional domain name (used as CloudFront origin)"
  value       = aws_s3_bucket.apk.bucket_regional_domain_name
}

output "feedback_bucket_arn" {
  description = "ARN of humyn-feedback-${var.env}"
  value       = aws_s3_bucket.feedback.arn
}

output "feedback_bucket_name" {
  description = "Name of humyn-feedback-${var.env}"
  value       = aws_s3_bucket.feedback.id
}
