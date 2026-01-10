import crypto from 'crypto';
import type { NextApiResponse } from 'next';

/**
 * --- ADMIN AUTHENTICATION REBUILD ---
 * 
 * Model: HttpOnly Cookie (Stateless HMAC Token)
 * Algo: HMAC-SHA256
 * Cookie Name: admin_access
 */

// --- CONFIGURATION ---
const COOKIE_NAME = 'admin_access';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Use persistent secrets. Fallback only for build time safety.
// IN PRODUCTION: AUTH_SECRET or ENCRYPTION_KEY or SHOPIFY_API_SECRET MUST BE SET.
const SECRET = process.env.AUTH_SECRET ||
  process.env.ENCRYPTION_KEY ||
  process.env.SHOPIFY_API_SECRET ||
  'critical-security-fail-no-secret-set';

if (SECRET === 'critical-security-fail-no-secret-set' && process.env.NODE_ENV === 'production') {
  console.error('[Admin Auth] CRITICAL: No secret set in environment! Auth will fail or be insecure.');
}

// Hardcoded for this specific user request. 
// Recommend moving to AUTH_PASSWORD env var in future.
const ADMIN_PASSWORD = 'jalwanjalwan12';


// --- HELPERS ---

/**
 * Sign a payload into a JWT-like string: base64(json).hex(signature)
 */
function signToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return `${data}.${signature}`;
}

/**
 * Verify a token string. Returns payload or null.
 */
function verifyToken(token: string): any | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, signature] = parts;

  // Verify Signature
  const expectedSignature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  if (signature !== expectedSignature) {
    console.warn('[Admin Auth] Signature mismatch');
    return null;
  }

  // Parse Payload
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64').toString());

    // expiry check
    if (payload.exp < Date.now()) {
      console.warn('[Admin Auth] Token expired');
      return null;
    }

    return payload;
  } catch (e) {
    console.warn('[Admin Auth] Malformed payload');
    return null;
  }
}


// --- EXPORTS ---

/**
 * 1. Login Function
 * Verifies password -> Returns Token
 */
export function authenticateAdmin(password: string): string | null {
  if (password === ADMIN_PASSWORD) {
    const exp = Date.now() + SESSION_DURATION_MS;
    return signToken({ role: 'admin', exp });
  }
  return null;
}

/**
 * 2. Set Cookie Function (Login Success)
 */
export function setAuthCookie(res: NextApiResponse, token: string) {
  const isSecure = process.env.NODE_ENV === 'production';
  // Lax is safer for redirects, Strict is better for CSRF but can break initial navigation from external sites.
  // Given the "Login Loop" issues, Lax is the robust choice.
  const cookieValue = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_MS / 1000}`;

  if (isSecure) {
    res.setHeader('Set-Cookie', `${cookieValue}; Secure`);
  } else {
    res.setHeader('Set-Cookie', cookieValue);
  }
}

/**
 * 3. Verify Cookie Function (Middleware)
 */
export function verifyAuthCookie(cookies: Partial<{ [key: string]: string }>): boolean {
  const token = cookies[COOKIE_NAME];
  if (!token) {
    // Debug log only if verbose
    return false;
  }
  return !!verifyToken(token);
}

/**
 * 4. Clear Cookie Function (Logout)
 */
export function clearAuthCookie(res: NextApiResponse) {
  const isSecure = process.env.NODE_ENV === 'production';
  const cookieValue = `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

  if (isSecure) {
    res.setHeader('Set-Cookie', `${cookieValue}; Secure`);
  } else {
    res.setHeader('Set-Cookie', cookieValue);
  }
}
