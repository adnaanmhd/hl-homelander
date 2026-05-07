# Staging env — Terraform backend + provider config.
#
# Remote state lives in S3 (encrypted, versioned) with a DynamoDB lock table
# shared across envs. The state bucket and lock table are bootstrapped manually
# once via `infra/terraform/scripts/bootstrap-state-bucket.sh staging`.
#
# Two AWS providers are configured:
#   • default       — ap-south-1 (Mumbai); all compute + storage live here
#   • aws.us_east_1 — us-east-1; CloudFront ACM cert constraint only

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket         = "humyn-tf-state-staging"
    key            = "phase-1/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "humyn-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Env       = var.env
      ManagedBy = "terraform"
      Project   = "homelander"
    }
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Env       = var.env
      ManagedBy = "terraform"
      Project   = "homelander"
    }
  }
}
