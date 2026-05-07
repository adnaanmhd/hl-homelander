env    = "staging"
region = "ap-south-1"

# Replace before first `terraform apply` — see infra/terraform/README.md.
google_web_client_id = "REPLACE_ME_FROM_FIREBASE_CONSOLE"
ecr_repo_url         = "REPLACE_ME_AFTER_ECR_BOOTSTRAP"
image_tag            = "latest"
acm_cert_arn         = "REPLACE_ME_AFTER_ACM_BOOTSTRAP"

# GitHub repo identity for the OIDC sub claim — locks the deploy role
# to tokens minted only for this exact repo (T-1.10-05).
github_owner = "humyn-labs"
github_repo  = "homelander"
