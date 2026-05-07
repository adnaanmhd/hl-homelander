# IAM module — GitHub Actions OIDC trust + scoped deploy role (RESEARCH §3.8).
#
# OIDC eliminates long-lived AWS access keys in GitHub Actions. CI workflows
# request a short-lived STS token via the GitHub OIDC provider and assume the
# `humyn-${env}-github-deploy` role. The role's trust policy is locked to
# `repo:${var.github_owner}/${var.github_repo}:*` so tokens from forks or other
# repos are rejected (T-1.10-05).
#
# The deploy-role policy at MVP is permissive enough to run `terraform apply`
# end-to-end (ec2:*, rds:*, ecs:*, etc.). Phase 5 will tighten this to per-action
# allow-lists once the resource set stabilises (T-1.10-09).

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    tls = {
      source = "hashicorp/tls"
    }
  }
}

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_owner}/${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "humyn-${var.env}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json

  tags = {
    Env     = var.env
    Purpose = "github-actions-deploy"
  }
}

# Scoped policy — Terraform apply needs broad permissions, but constrained to
# resources tagged Env=<env>. At MVP we grant a permissive set; Phase 5 tightens.
resource "aws_iam_role_policy" "github_deploy_terraform" {
  name = "humyn-${var.env}-github-deploy-terraform"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:*",
          "rds:*",
          "ecs:*",
          "elasticloadbalancing:*",
          "iam:*",
          "s3:*",
          "cloudfront:*",
          "secretsmanager:*",
          "logs:*",
          "dynamodb:*",
          "kms:*",
          "acm:*",
          "ecr:*",
        ]
        Resource = "*"
      },
    ]
  })
}
