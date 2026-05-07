# Staging env composition — wires the 7 modules together.
#
# Module call order (Terraform dependency-graph driven, not literal): network →
# secrets + s3 (parallel; no cross-deps) → rds (needs network) → cloudfront
# (needs s3) → iam → ecs (needs everything).

module "network" {
  source = "../../modules/network"

  env    = var.env
  region = var.region
}

module "secrets" {
  source = "../../modules/secrets"
}

module "rds" {
  source = "../../modules/rds"

  env                  = var.env
  private_subnet_id    = module.network.private_subnet_id
  sg_rds_id            = module.network.sg_rds_id
  instance_class       = "db.t4g.medium"
  allocated_storage_gb = 100
}

module "s3" {
  source = "../../modules/s3"

  env = var.env
}

module "cloudfront" {
  source = "../../modules/cloudfront"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  env                        = var.env
  apk_bucket_regional_domain = module.s3.apk_bucket_regional_domain
}

module "iam" {
  source = "../../modules/iam"

  env          = var.env
  github_owner = var.github_owner
  github_repo  = var.github_repo
}

module "ecs" {
  source = "../../modules/ecs"

  env    = var.env
  region = var.region

  vpc_id            = module.network.vpc_id
  public_subnet_id  = module.network.public_subnet_id
  private_subnet_id = module.network.private_subnet_id
  sg_alb_id         = module.network.sg_alb_id
  sg_fargate_id     = module.network.sg_fargate_id

  ecr_repo_url         = var.ecr_repo_url
  image_tag            = var.image_tag
  google_web_client_id = var.google_web_client_id

  recordings_bucket_name = module.s3.recordings_bucket_name
  recordings_bucket_arn  = module.s3.recordings_bucket_arn
  apk_bucket_name        = module.s3.apk_bucket_name
  apk_bucket_arn         = module.s3.apk_bucket_arn
  feedback_bucket_name   = module.s3.feedback_bucket_name
  feedback_bucket_arn    = module.s3.feedback_bucket_arn

  jwt_secret_arn        = module.secrets.jwt_secret_arn
  gcp_sa_secret_arn     = module.secrets.gcp_sa_secret_arn
  rds_master_secret_arn = module.rds.rds_master_secret_arn

  acm_cert_arn = var.acm_cert_arn
}
