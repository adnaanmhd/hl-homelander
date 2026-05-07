output "vpc_id" {
  description = "VPC ID — consumed by ECS module for ALB target group"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "Public subnet ID — ALB lives here"
  value       = aws_subnet.public_a.id
}

output "private_subnet_id" {
  description = "Private subnet ID — Fargate tasks + RDS live here"
  value       = aws_subnet.private_a.id
}

output "sg_alb_id" {
  description = "ALB security group (ingress 443 from internet)"
  value       = aws_security_group.alb.id
}

output "sg_fargate_id" {
  description = "Fargate security group (ingress 8080 from sg_alb only)"
  value       = aws_security_group.fargate.id
}

output "sg_rds_id" {
  description = "RDS security group (ingress 5432 from sg_fargate only)"
  value       = aws_security_group.rds.id
}
