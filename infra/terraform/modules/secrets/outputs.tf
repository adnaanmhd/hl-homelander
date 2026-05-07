output "jwt_secret_arn" {
  description = "ARN of humyn/jwt/signing-secret — consumed by ECS execution role + task secret injection"
  value       = aws_secretsmanager_secret.jwt_signing.arn
}

output "gcp_sa_secret_arn" {
  description = "ARN of humyn/gcp/play-integrity-sa-key — consumed by ECS execution role + task secret injection"
  value       = aws_secretsmanager_secret.gcp_play_integrity_sa.arn
}

output "cloudfront_signing_key_arn" {
  description = "ARN of humyn/cloudfront/signing-key — RSA PEM private key for CloudFront URL signing"
  value       = aws_secretsmanager_secret.cloudfront_signing_key.arn
}

output "cloudfront_key_pair_id_arn" {
  description = "ARN of humyn/cloudfront/key-pair-id — string, paired with humyn/cloudfront/signing-key"
  value       = aws_secretsmanager_secret.cloudfront_key_pair_id.arn
}
