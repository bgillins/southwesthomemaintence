// Types for env.cjs (plain JavaScript so the Node scripts can load it directly).
export const TEST_NAMES: { schema: string; bucket: string; policyPrefix: string };
export const PORTS: { app: number; email: number };
export const APP_URL: string;
export const EMAIL_URL: string;
export const TEST_EMAIL_PATTERN: RegExp;
export function testEmail(name: string): string;
export function loadEnv(): Record<string, string | undefined>;
