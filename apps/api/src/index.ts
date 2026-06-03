import { bootstrapSecrets } from './lib/secrets-loader.js';

// 1. Fetch AWS Secrets Manager payloads and populate process.env
await bootstrapSecrets();

// 2. Dynamically import the main server once environment is ready
await import('./server.js');
