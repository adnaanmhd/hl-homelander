# Secrets Manager entries (RESEARCH §3.4 + plan 07 API-09 CloudFront-signed playback URLs).
#
# Initial secret values are seeded out-of-band after `terraform apply`:
#
#   openssl rand -base64 32 | aws secretsmanager put-secret-value \
#     --secret-id humyn/jwt/signing-secret --secret-string -
#
#   aws secretsmanager put-secret-value \
#     --secret-id humyn/gcp/play-integrity-sa-key \
#     --secret-string file://gcp-play-integrity-sa-key.json
#
#   openssl genrsa -out cf-private.pem 2048
#   openssl rsa -in cf-private.pem -pubout -out cf-public.pem
#   aws cloudfront create-public-key \
#     --public-key-config "Name=humyn-prod,EncodedKey=$(cat cf-public.pem | base64),CallerReference=$(date +%s)"
#   aws secretsmanager put-secret-value \
#     --secret-id humyn/cloudfront/signing-key --secret-string file://cf-private.pem
#   aws secretsmanager put-secret-value \
#     --secret-id humyn/cloudfront/key-pair-id \
#     --secret-string '<key-pair-id-from-create-public-key>'
#
# Rotation: manual at MVP; Lambda rotation later. recovery_window_in_days=7
# guards against accidental delete (Phase-1 change-management trade-off).

resource "aws_secretsmanager_secret" "jwt_signing" {
  name                    = "humyn/jwt/signing-secret"
  description             = "HS256 256-bit signing secret per D-AUTH-04"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "gcp_play_integrity_sa" {
  name                    = "humyn/gcp/play-integrity-sa-key"
  description             = "GCP service account JSON for Play Integrity decodeIntegrityToken"
  recovery_window_in_days = 7
}

# CloudFront signing key (private RSA PEM) — used by /recordings/:id (API-09 plan 07)
# to mint short-TTL playback URLs. The corresponding public key is uploaded to
# CloudFront as a key-pair (modules/cloudfront/main.tf) and CloudFront uses it
# to verify the signed URLs. Rotation = generate a new keypair, upload public,
# put-secret-value the private PEM, drain the old key-pair after a grace window.
resource "aws_secretsmanager_secret" "cloudfront_signing_key" {
  name                    = "humyn/cloudfront/signing-key"
  description             = "CloudFront signing private key (RSA PEM) for /recordings/:id playback URLs (API-09)"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "cloudfront_key_pair_id" {
  name                    = "humyn/cloudfront/key-pair-id"
  description             = "CloudFront public-key key-pair-id (string) — paired with humyn/cloudfront/signing-key"
  recovery_window_in_days = 7
}
