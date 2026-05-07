variable "env" {
  description = "Deployment environment: staging | prod"
  type        = string
}

variable "apk_bucket_regional_domain" {
  description = "Regional domain name of humyn-apk-${env} bucket — origin for the APK distribution"
  type        = string
}
