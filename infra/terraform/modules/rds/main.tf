# RDS Postgres 17 + pgvector — single-AZ at MVP per D-HOST-02.
#
# `shared_preload_libraries = pg_stat_statements,vector` plus the migration's
# `CREATE EXTENSION IF NOT EXISTS vector` is the canonical pgvector activation
# pattern (RESEARCH §3.3). pg_stat_statements is enabled for query observability
# (slow queries get flagged via log_min_duration_statement = 500ms).
#
# Master credentials are managed by Secrets Manager (`manage_master_user_password`),
# which auto-creates a secret with key `username`, `password`, `host`, `port`,
# `dbname`, `engine`, and `url` — the ECS task definition references the `:url::`
# JSON-key extraction syntax to pull DATABASE_URL straight into the container.

resource "aws_db_subnet_group" "main" {
  name       = "humyn-${var.env}-db"
  subnet_ids = [var.private_subnet_id]

  tags = {
    Name = "humyn-${var.env}-db-subnet-group"
    Env  = var.env
  }
}

resource "aws_db_parameter_group" "pg17_pgvector" {
  family      = "postgres17"
  name        = "humyn-pg17-pgvector-${var.env}"
  description = "Postgres 17 + pgvector preload + slow-query logging"

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements,vector"
    apply_method = "pending-reboot"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  tags = {
    Env = var.env
  }
}

resource "aws_db_instance" "main" {
  identifier             = "humyn-${var.env}"
  engine                 = "postgres"
  engine_version         = "17.2"
  instance_class         = var.instance_class
  allocated_storage      = var.allocated_storage_gb
  storage_type           = "gp3"
  storage_encrypted      = true
  multi_az               = false # D-HOST-02: single-AZ at MVP
  publicly_accessible    = false
  vpc_security_group_ids = [var.sg_rds_id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.pg17_pgvector.name

  backup_retention_period = 7
  deletion_protection     = var.env == "prod"
  skip_final_snapshot     = var.env != "prod"
  apply_immediately       = false

  username                    = "humyn_admin"
  manage_master_user_password = true # Secrets Manager-managed (RESEARCH §3.3)

  tags = {
    Name = "humyn-${var.env}-rds"
    Env  = var.env
  }
}
