# ECS module — Fargate cluster + task definition + ALB + scoped IAM roles.
#
# Single-task-at-MVP per D-HOST-03 (`desired_count = 1`). Two IAM roles:
#
#   ecs_execution — used by ECS itself to pull the image, fetch secrets, write
#                   logs. Has the AWS-managed `AmazonECSTaskExecutionRolePolicy`
#                   plus a custom inline policy granting `secretsmanager:GetSecretValue`
#                   on EXACTLY THREE ARNs (jwt, play-integrity, RDS master).
#
#   ecs_task      — assumed by the running container at runtime. Scoped per
#                   RESEARCH §3.8 — read+write on humyn-recordings-${env}/*,
#                   read on humyn-apk-${env}/*, read+write on humyn-feedback-${env}/*.
#                   No `*:*`. No cross-bucket leakage.
#
# Container env injection follows the ECS-native pattern: non-secret values via
# `environment`, secrets via `secrets` (which ECS resolves at task start by
# calling secretsmanager:GetSecretValue under the execution role).
#
# DATABASE_URL uses the JSON-key extraction syntax `:url::` so the container
# receives just the connection-string field of the RDS-managed secret, not the
# full JSON blob.
#
# CPU 512 / memory 1024 per the plan body (a smaller right-sizing of RESEARCH
# §3.5's 1024/2048 — bumped back up via the `cpu` / `memory` task-def fields
# in Phase 5 once we have load data).

resource "aws_ecs_cluster" "main" {
  name = "humyn-${var.env}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Env = var.env
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/humyn/${var.env}/api"
  retention_in_days = 30

  tags = {
    Env = var.env
  }
}

# ── Task execution role (image pulls, secrets, logs) ──────────────────────

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "humyn-${var.env}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Env = var.env
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Custom inline policy — secretsmanager:GetSecretValue scoped to the three
# named ARNs only (RESEARCH §3.8).
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "humyn-${var.env}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        var.jwt_secret_arn,
        var.gcp_sa_secret_arn,
        var.rds_master_secret_arn,
      ]
    }]
  })
}

# ── Task role (runtime container permissions) ─────────────────────────────

resource "aws_iam_role" "ecs_task" {
  name               = "humyn-${var.env}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Env = var.env
  }
}

# Recordings + APK + Feedback bucket-scoped permissions per RESEARCH §3.8.
resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "humyn-${var.env}-ecs-task-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:AbortMultipartUpload",
          "s3:ListMultipartUploadParts",
        ]
        Resource = "${var.recordings_bucket_arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = var.recordings_bucket_arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${var.apk_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
        ]
        Resource = "${var.feedback_bucket_arn}/*"
      },
    ]
  })
}

# ── Task definition ────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "api" {
  family                   = "humyn-${var.env}-api"
  cpu                      = "512"
  memory                   = "1024"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "api"
    image = "${var.ecr_repo_url}:${var.image_tag}"

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = var.env },
      { name = "AWS_REGION", value = var.region },
      { name = "GOOGLE_WEB_CLIENT_ID", value = var.google_web_client_id },
      { name = "RECORDINGS_BUCKET", value = var.recordings_bucket_name },
      { name = "APK_BUCKET", value = var.apk_bucket_name },
      { name = "FEEDBACK_BUCKET", value = var.feedback_bucket_name },
    ]

    # ECS resolves these at task start via execution-role
    # secretsmanager:GetSecretValue calls. The `:url::` suffix on the RDS
    # master ARN extracts the `url` JSON-key only.
    secrets = [
      {
        name      = "JWT_SIGNING_SECRET"
        valueFrom = var.jwt_secret_arn
      },
      {
        name      = "PLAY_INTEGRITY_SA_KEY_JSON"
        valueFrom = var.gcp_sa_secret_arn
      },
      {
        name      = "DATABASE_URL"
        valueFrom = "${var.rds_master_secret_arn}:url::"
      },
    ]

    healthCheck = {
      command  = ["CMD-SHELL", "wget -q -O- http://localhost:8080/healthz || exit 1"]
      interval = 30
      timeout  = 5
      retries  = 3
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "api"
      }
    }
  }])

  tags = {
    Env = var.env
  }
}

# ── ALB — public-facing TLS ───────────────────────────────────────────────

resource "aws_lb" "api" {
  name               = "humyn-${var.env}-api"
  load_balancer_type = "application"
  security_groups    = [var.sg_alb_id]
  subnets            = [var.public_subnet_id]

  tags = {
    Env = var.env
  }
}

resource "aws_lb_target_group" "api" {
  name        = "humyn-${var.env}-api"
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    path                = "/healthz"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = {
    Env = var.env
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.acm_cert_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ── ECS service — single Fargate task at MVP (D-HOST-03) ──────────────────

resource "aws_ecs_service" "api" {
  name            = "humyn-${var.env}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  launch_type     = "FARGATE"
  # ⚠ desired_count = 1 is ALSO a Bug 4 / D2 auth invariant: the single-device
  # eviction LRU (apps/api/src/auth/installation-binding.ts) is in-process and
  # NOT cache-coherent across instances. Scaling this >1 lets a device evicted on
  # one task stay authorized on another for up to the 60s cache TTL — switch that
  # lookup to read-through (or a shared invalidation channel) BEFORE raising this.
  desired_count   = 1

  network_configuration {
    subnets          = [var.private_subnet_id]
    security_groups  = [var.sg_fargate_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8080
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  depends_on = [aws_lb_listener.https]

  tags = {
    Env = var.env
  }
}
