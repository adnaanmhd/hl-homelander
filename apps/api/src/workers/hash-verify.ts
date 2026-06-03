import { bootstrapSecrets } from '../lib/secrets-loader.js';

// 1. Fetch AWS Secrets Manager payloads and populate process.env
await bootstrapSecrets();

// 2. Dynamically import the worker queue loop runner once environment is ready
await import('./hash-verify-run.js');
