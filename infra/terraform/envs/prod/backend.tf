# Prod env — Terraform backend + provider config.
#
# Same shape as staging but uses `humyn-tf-state-prod` bucket. The DynamoDB
# lock table (`humyn-tf-locks`) is shared across envs — the LockID key in the
# table is per-state-key so there's no collision risk and a single shared lock
# table avoids per-env management overhead.

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
    bucket         = "humyn-tf-state-prod"
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
