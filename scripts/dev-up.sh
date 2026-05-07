#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[dev-up] Starting Postgres + LocalStack + pgAdmin ..."
docker compose up -d postgres localstack pgadmin

echo "[dev-up] Waiting for Postgres to be healthy ..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U humyn -d humyn_dev >/dev/null 2>&1; then
    echo "[dev-up] Postgres ready."
    break
  fi
  echo "  ... still waiting ($i/30)"
  sleep 2
done

echo "[dev-up] Waiting for LocalStack to be healthy ..."
for i in $(seq 1 30); do
  if curl -fsS http://localhost:4566/_localstack/health >/dev/null 2>&1; then
    echo "[dev-up] LocalStack ready."
    break
  fi
  echo "  ... still waiting ($i/30)"
  sleep 2
done

echo "[dev-up] Verifying buckets exist (LocalStack init may still be running)..."
for i in $(seq 1 15); do
  if docker compose exec -T localstack awslocal s3 ls 2>/dev/null | grep -q "humyn-recordings-dev"; then
    echo "[dev-up] Buckets present."
    break
  fi
  echo "  ... still waiting for init scripts ($i/15)"
  sleep 2
done

echo
echo "============================================================"
echo "[dev-up] Environment ready."
echo "  Postgres   localhost:5432   user=humyn pass=humyn db=humyn_dev"
echo "  LocalStack http://localhost:4566 (S3 + Secrets Manager)"
echo "  pgAdmin    http://localhost:5050 (admin@humyn.local / admin)"
echo
echo "Next steps:"
echo "  1. cp .env.example .env   (if not already done)"
echo "  2. cd apps/api && pnpm db:migrate   (applies 0001_init.sql)"
echo "  3. cd apps/api && pnpm dev          (starts Fastify on :8080)"
echo "============================================================"
