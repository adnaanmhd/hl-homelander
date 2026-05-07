# Humyn Labs Capture (Homelander)

Android-first crowdsourced data-collection app for training physical/embodied AI.

See `.planning/PROJECT.md` for project overview and locked constraints.

## Dev Environment

Bring up Postgres 17 + pgvector, LocalStack 4.x (S3 + Secrets Manager), and pgAdmin:

```sh
./scripts/dev-up.sh
```

Then apply the schema and start the API:

```sh
cp .env.example .env
cd apps/api
pnpm db:migrate
pnpm dev
```

## Workspace Layout

- `apps/api/` — Fastify backend
- `apps/mobile/` — React Native client
- `shared/types/` — Zod schemas shared between api and mobile
- `infra/terraform/` — AWS infrastructure as code (staging + prod)
- `infra/localstack/` — LocalStack init scripts for local dev

## Tooling Versions

- Node: 22 LTS (`.nvmrc`)
- pnpm: 9+
- Postgres: 17 with pgvector 0.8.0 (via `pgvector/pgvector:pg17`)
- LocalStack: Community 4.x

See `.planning/research/STACK.md` for the full pinned stack.

## GSD Workflow

This repo uses [GSD](.claude/get-shit-done/) for planning and execution. Start work via:

- `/gsd-execute-phase` for planned phase work
- `/gsd-quick` for small fixes
- `/gsd-debug` for investigation
