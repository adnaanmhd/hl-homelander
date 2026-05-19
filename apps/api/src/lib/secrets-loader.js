import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
export async function bootstrapSecrets() {
    const secretName = process.env.APP_NAME;
    if (!secretName) {
        // No APP_NAME provided (e.g. local environment). Fall back to standard environment files.
        return;
    }
    const region = process.env.AWS_REGION || 'ap-south-1';
    console.log(`[SecretsLoader] APP_NAME = "${secretName}". Fetching secrets from AWS Secrets Manager in ${region}...`);
    const client = new SecretsManagerClient({ region });
    try {
        const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
        if (response.SecretString) {
            const secrets = JSON.parse(response.SecretString);
            let loadedCount = 0;
            for (const [key, value] of Object.entries(secrets)) {
                // Populate process.env unless explicitly overridden beforehand
                if (process.env[key] === undefined) {
                    process.env[key] = String(value);
                    loadedCount++;
                }
            }
            console.log(`[SecretsLoader] Successfully loaded ${loadedCount} environment variables from Secrets Manager.`);
        }
        else {
            console.warn(`[SecretsLoader] Secrets Manager returned an empty payload for secret: ${secretName}`);
        }
    }
    catch (error) {
        console.error(`[SecretsLoader] CRITICAL: Failed to load secrets from AWS Secrets Manager:`, error);
        // Crash the process immediately to prevent the server from starting with a corrupted/blank config
        throw error;
    }
}
//# sourceMappingURL=secrets-loader.js.map