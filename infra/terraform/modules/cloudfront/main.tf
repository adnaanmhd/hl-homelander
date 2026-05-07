# CloudFront — APK distribution + recordings playback signing keypair.
#
# CloudFront ACM certs MUST be in us-east-1 regardless of the rest of the
# deployment region. This is a hard CloudFront constraint, hence the aliased
# `aws.us_east_1` provider.
#
# This module declares:
#   • The us-east-1 ACM certificate for apk.humyn.ai (DNS-validated).
#   • The CloudFront OAC + distribution for the APK bucket (public via CloudFront).
#   • The recordings playback signer-key infrastructure (key group + public-key
#     shell — the actual public-key body is uploaded out-of-band after secrets
#     are seeded, see modules/secrets/main.tf comments).
#
# The recordings playback distribution itself is intentionally NOT created here:
# at MVP, /recordings/:id (API-09 plan 07) signs S3 URLs directly via the
# CloudFront signer (the @aws-sdk/cloudfront-signer code path). Adding a
# CloudFront-fronted recordings distribution is a Phase 5 follow-up.

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

resource "aws_acm_certificate" "apk" {
  provider          = aws.us_east_1
  domain_name       = "apk.humyn.ai"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Env     = var.env
    Purpose = "cloudfront-apk"
  }
}

resource "aws_cloudfront_origin_access_control" "apk" {
  name                              = "humyn-apk-${var.env}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "apk" {
  enabled         = true
  is_ipv6_enabled = true
  aliases         = ["apk.humyn.ai"]
  comment         = "humyn-apk-${var.env} APK distribution"

  default_cache_behavior {
    target_origin_id       = "apk-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  origin {
    origin_id                = "apk-s3"
    domain_name              = var.apk_bucket_regional_domain
    origin_access_control_id = aws_cloudfront_origin_access_control.apk.id
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.apk.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Env     = var.env
    Purpose = "cloudfront-apk"
  }
}
