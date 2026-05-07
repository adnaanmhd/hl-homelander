import { buildApp } from './app.js';

async function main() {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 8080);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
}

main().catch((err) => {
  console.error('boot_failed', err);
  process.exit(1);
});
