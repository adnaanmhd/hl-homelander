# verify-queue — the prod hash-verify pipeline trigger leg (VERIFY-01) + the
# worker ECS task (Pattern 2) + the queue-depth autoscaling (VERIFY-07) + the
# least-privilege worker IAM (threat T-5-05-05).
#
# Flow (prod): a finished upload writes video.mp4 / imu.csv / metadata.json into
# humyn-recordings-${env} → S3 emits an "Object Created" EventBridge event →
# `aws_cloudwatch_event_rule.recordings_object_created` (filtered to the three
# key suffixes) → `aws_sqs_queue.verify` → a thin SQS poller (a 2nd container in
# the worker task — `node dist/workers/sqs-poller.js`) long-polls the queue and
# calls `enqueueVerify(recordingId)` → the BullMQ `Worker('verify')` re-hashes
# the bytes from S3 (read-only) and flips `qa_status`. The `recordings_to_verify`
# row + the `verify-sweep` cron are the durable backstop either way (at-least-once).
#
# Dev does NOT instantiate this module — local dev uses `docker compose up redis`,
# a local `tsx` worker, and the `/recordings/:id/finalize` LocalStack shim that
# enqueues the BullMQ job directly (Pitfall 6: LocalStack's S3→EventBridge→SQS
# path is flaky).
#
# Files travel byte-for-byte device→S3 (CLAUDE.md file-fidelity rule); the worker
# only READS the recording bytes — its task role is s3:GetObject only, no writes.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

locals {
  base_tags = merge({ Env = var.env, ManagedBy = "terraform", Component = "verify-queue" }, var.tags)
}

# ── SQS: the verify queue + its DLQ ───────────────────────────────────────

resource "aws_sqs_queue" "verify_dlq" {
  name                      = "humyn-${var.env}-verify-dlq"
  message_retention_seconds = 1209600 # 14 days
  tags                      = local.base_tags
}

resource "aws_sqs_queue" "verify" {
  name = "humyn-${var.env}-verify"
  # The worker re-hashes potentially multi-GB objects — give the consumer plenty
  # of time before the message becomes visible again.
  visibility_timeout_seconds = 900
  message_retention_seconds  = 345600 # 4 days
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.verify_dlq.arn
    maxReceiveCount     = 5
  })
  tags = local.base_tags
}

# ── S3 → EventBridge → SQS ────────────────────────────────────────────────

# Enable EventBridge notifications on the recordings bucket. A bucket can have
# exactly one aws_s3_bucket_notification — the s3 module currently sets none, so
# this is the single owner.
resource "aws_s3_bucket_notification" "recordings" {
  bucket      = var.recordings_bucket_name
  eventbridge = true
}

resource "aws_cloudwatch_event_rule" "recordings_object_created" {
  name        = "humyn-${var.env}-recordings-object-created"
  description = "S3 Object Created on the recordings bucket for the three upload-bundle key suffixes → verify queue"

  event_pattern = jsonencode({
    source        = ["aws.s3"]
    "detail-type" = ["Object Created"]
    detail = {
      bucket = { name = [var.recordings_bucket_name] }
      object = {
        key = [
          { suffix = ".mp4" },
          { suffix = ".csv" },
          { suffix = "metadata.json" },
        ]
      }
    }
  })

  tags = local.base_tags
}

resource "aws_cloudwatch_event_target" "verify_queue" {
  rule = aws_cloudwatch_event_rule.recordings_object_created.name
  arn  = aws_sqs_queue.verify.arn
}

# Queue policy — allow EventBridge (and only EventBridge, scoped by SourceArn) to
# SendMessage. NOT a public Principal: * (threat T-5-05-06).
data "aws_iam_policy_document" "verify_queue_policy" {
  statement {
    sid     = "AllowEventBridgeSend"
    effect  = "Allow"
    actions = ["sqs:SendMessage"]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    resources = [aws_sqs_queue.verify.arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.recordings_object_created.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "verify" {
  queue_url = aws_sqs_queue.verify.id
  policy    = data.aws_iam_policy_document.verify_queue_policy.json
}

# ── Worker IAM — least privilege (threat T-5-05-05) ───────────────────────

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

# Execution role — image pulls + log writes + (DB) secret fetch at task start.
resource "aws_iam_role" "worker_execution_role" {
  name               = "humyn-${var.env}-worker-execution"
  assume_role_policy  = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.base_tags
}

resource "aws_iam_role_policy_attachment" "worker_execution_managed" {
  role       = aws_iam_role.worker_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "worker_execution_secrets" {
  name = "humyn-${var.env}-worker-execution-secrets"
  role = aws_iam_role.worker_execution_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [var.db_secret_arn]
    }]
  })
}

# Task role — runtime container permissions. READ-ONLY on the recordings bucket
# (s3:GetObject only); Receive/Delete on the verify queue; nothing else (no bucket
# writes, no other queues, no other secrets — byte-fidelity invariant at the IAM layer).
resource "aws_iam_role" "worker_task_role" {
  name               = "humyn-${var.env}-worker-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.base_tags
}

resource "aws_iam_role_policy" "worker_task" {
  name = "humyn-${var.env}-worker-task"
  role = aws_iam_role.worker_task_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadRecordingsBucketObjects"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${var.recordings_bucket_arn}/*"
      },
      {
        Sid      = "ConsumeVerifyQueue"
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.verify.arn
      },
    ]
  })
}

# ── Worker logs ───────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/humyn/${var.env}/worker"
  retention_in_days = 30
  tags              = local.base_tags
}

# ── Worker task definition — two containers: the BullMQ worker + the SQS poller ─

resource "aws_ecs_task_definition" "worker" {
  family                   = "humyn-${var.env}-worker"
  cpu                      = "512"
  memory                   = "1024"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.worker_execution_role.arn
  task_role_arn            = aws_iam_role.worker_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "hash-verify"
      image     = var.worker_image
      command   = ["node", "dist/workers/hash-verify.js"]
      essential = true
      environment = [
        { name = "NODE_ENV", value = var.env },
        { name = "AWS_REGION", value = var.region },
        { name = "RECORDINGS_BUCKET", value = var.recordings_bucket_name },
        { name = "REDIS_URL", value = var.redis_endpoint },
        # NOTE: no AWS_ENDPOINT_URL — that flag is LocalStack-only (the /finalize
        # dev shim). In prod the trigger is the EventBridge→SQS→poller leg below.
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${var.db_secret_arn}:url::" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.worker.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "hash-verify"
        }
      }
    },
    {
      # Thin SQS long-poll → enqueueVerify(recordingId) → DeleteMessage — the prod
      # EventBridge→SQS→BullMQ trigger leg, implemented in apps/api/src/workers/sqs-poller.ts
      # (Plan 05-12). 2nd container in the same task (cheap; shares the worker's
      # lifecycle); if it hiccups, the recordings_to_verify row + the verify-sweep
      # cron re-enqueue.
      name      = "sqs-poller"
      image     = var.worker_image
      command   = ["node", "dist/workers/sqs-poller.js"]
      essential = false
      environment = [
        { name = "NODE_ENV", value = var.env },
        { name = "AWS_REGION", value = var.region },
        { name = "REDIS_URL", value = var.redis_endpoint },
        { name = "VERIFY_QUEUE_URL", value = aws_sqs_queue.verify.id },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${var.db_secret_arn}:url::" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.worker.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "sqs-poller"
        }
      }
    },
  ])

  tags = local.base_tags
}

# ── Worker service — queue consumer (no load balancer), scale-from-zero ────

resource "aws_ecs_service" "worker" {
  name            = "humyn-${var.env}-worker"
  cluster         = var.ecs_cluster_arn
  task_definition = aws_ecs_task_definition.worker.arn
  launch_type     = "FARGATE"
  desired_count   = var.min_tasks

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 200

  # The autoscaler owns desired_count after the first apply.
  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = local.base_tags
}

# ── Autoscaling on backlog-per-task (VERIFY-07) ───────────────────────────

resource "aws_appautoscaling_target" "worker" {
  service_namespace  = "ecs"
  resource_id        = "service/${var.ecs_cluster_name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.min_tasks
  max_capacity       = var.max_tasks
}

# Target-tracking on a metric-math expression: backlog-per-task =
# SQS ApproximateNumberOfMessages ÷ max(running task count, 1). Keeping it near
# var.backlog_target_per_task scales the worker fleet with the queue depth.
resource "aws_appautoscaling_policy" "worker_backlog" {
  name               = "humyn-${var.env}-worker-backlog-per-task"
  service_namespace  = aws_appautoscaling_target.worker.service_namespace
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value       = var.backlog_target_per_task
    scale_in_cooldown  = 120
    scale_out_cooldown = 60

    customized_metric_specification {
      metrics {
        id          = "backlog_per_task"
        label       = "Backlog messages per running worker task"
        return_data = true
        expression  = "msgs / IF(tasks < 1, 1, tasks)"
      }
      metrics {
        id          = "msgs"
        return_data = false
        metric_stat {
          metric {
            namespace   = "AWS/SQS"
            metric_name = "ApproximateNumberOfMessagesVisible"
            dimensions {
              name  = "QueueName"
              value = aws_sqs_queue.verify.name
            }
          }
          stat = "Average"
        }
      }
      metrics {
        id          = "tasks"
        return_data = false
        metric_stat {
          metric {
            namespace   = "ECS/ContainerInsights"
            metric_name = "RunningTaskCount"
            dimensions {
              name  = "ClusterName"
              value = var.ecs_cluster_name
            }
            dimensions {
              name  = "ServiceName"
              value = aws_ecs_service.worker.name
            }
          }
          stat = "Average"
        }
      }
    }
  }
}
