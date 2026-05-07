# Network module — VPC + public/private subnets (single AZ at MVP) + IGW + NAT GW + 3 SGs.
#
# Single-AZ at MVP per D-HOST-02. When we go multi-AZ in Phase 5+, add additional
# subnets in ${var.region}b/c with no downtime — the VPC, IGW, route tables, and SGs
# are all reusable.
#
# Security-group topology (RESEARCH §3.2):
#   sg_alb     — ingress 443 from 0.0.0.0/0
#   sg_fargate — ingress 8080 from sg_alb only
#   sg_rds     — ingress 5432 from sg_fargate only

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "humyn-${var.env}-vpc"
    Env  = var.env
  }
}

# Public subnet hosts ALB + NAT GW.
resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.0.0/20"
  availability_zone       = "${var.region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "humyn-${var.env}-public-a"
    Env  = var.env
  }
}

# Private subnet hosts Fargate tasks + RDS.
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.16.0/20"
  availability_zone = "${var.region}a"

  tags = {
    Name = "humyn-${var.env}-private-a"
    Env  = var.env
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "humyn-${var.env}-igw"
    Env  = var.env
  }
}

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "humyn-${var.env}-nat-eip"
    Env  = var.env
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_a.id

  tags = {
    Name = "humyn-${var.env}-nat"
    Env  = var.env
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "humyn-${var.env}-rt-public"
    Env  = var.env
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "humyn-${var.env}-rt-private"
    Env  = var.env
  }
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.private.id
}

# ── Security groups ────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "humyn-${var.env}-sg-alb"
  description = "ALB ingress 443 from internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from internet"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "egress all"
  }

  tags = {
    Name = "humyn-${var.env}-sg-alb"
    Env  = var.env
  }
}

resource "aws_security_group" "fargate" {
  name        = "humyn-${var.env}-sg-fargate"
  description = "Fargate task ingress only from ALB SG"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "egress all (Secrets Manager, S3, ECR, RDS)"
  }

  tags = {
    Name = "humyn-${var.env}-sg-fargate"
    Env  = var.env
  }
}

# Separate rule resource avoids the SG-to-SG circular ref pitfall.
resource "aws_security_group_rule" "fargate_from_alb" {
  type                     = "ingress"
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = aws_security_group.fargate.id
  description              = "API container port from ALB only"
}

resource "aws_security_group" "rds" {
  name        = "humyn-${var.env}-sg-rds"
  description = "RDS ingress only from Fargate SG"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "egress all"
  }

  tags = {
    Name = "humyn-${var.env}-sg-rds"
    Env  = var.env
  }
}

resource "aws_security_group_rule" "rds_from_fargate" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.fargate.id
  security_group_id        = aws_security_group.rds.id
  description              = "Postgres from Fargate SG only"
}
