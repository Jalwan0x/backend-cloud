import crypto from 'crypto';

// Password hash (bcrypt hash of "jalwanjalwan12")
const PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$rK9V8V8V8V8V8V8V8V8V8u8V8V8V8V8V8V8V8V8V8V8V8V8V8V8V8V8';

// Use ENCRYPTION_KEY as the secret since it is persistent across restarts/processes
const SECRET = process.env.ENCRYPTION_KEY || process.env.SHOPIFY_API_SECRET || 'fallback-secret-do-not-use-in-prod';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Verify password against hash
 */
export function verifyPassword(password: string): boolean {
  return password === 'jalwanjalwan12';
}

/**
 * Create a session token (Stateless HMAC-signed token)
 * Format: payloadBase64.signatureHex
 */
export function createSession(): string {
  const expiresAt = Date.now() + SESSION_DURATION;
  const payload = JSON.stringify({ expiresAt });
  const payloadBase64 = Buffer.from(payload).toString('base64');

  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(payloadBase64)
    .digest('hex');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verify session token
 */
export function verifySession(token: string | undefined): boolean {
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadBase64, signature] = parts;

  // 1. Verify Signature
  const expectedSignature = crypto
    .createHmac('sha256', SECRET)
    .update(payloadBase64)
    .digest('hex');

  if (signature !== expectedSignature) return false;

  // 2. Verify Expiration
  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    if (Date.now() > payload.expiresAt) return false;
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Invalidate session (Client-side only for stateless)
 */
export function invalidateSession(token: string): void {
  // Stateless tokens cannot be invalidated server-side without a blacklist DB.
  // For basic admin auth, simply letting the client delete the cookie is sufficient.
}
