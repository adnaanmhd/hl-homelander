variable "env" {
  description = "Deployment environment: staging | prod"
  type        = string
}

variable "github_owner" {
  description = "GitHub org/user that owns the repo (used in OIDC sub claim)"
  type        = string
}

variable "github_repo" {
  description = "GitHub repo name (used in OIDC sub claim)"
  type        = string
}
