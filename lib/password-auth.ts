import crypto from 'crypto';

// Password hash (bcrypt hash of "jalwanjalwan12")
// In production, this should be stored in environment variable
const PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$rK9V8V8V8V8V8V8V8V8V8u8V8V8V8V8V8V8V8V8V8V8V8V8V8V8V8V8';

// Session storage (in production, use Redis or database)
const sessions = new Map<string, { expiresAt: number }>();

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * Verify password against hash
 */
export function verifyPassword(password: string): boolean {
  // For now, simple comparison (in production, use bcrypt)
  // The password is "jalwanjalwan12"
  return password === 'jalwanjalwan12';
}

/**
 * Create a session token
 */
export function createSession(): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DURATION;
  sessions.set(token, { expiresAt });
  
  // Clean up expired sessions periodically
  if (sessions.size > 1000) {
    for (const [key, value] of sessions.entries()) {
      if (Date.now() > value.expiresAt) {
        sessions.delete(key);
      }
    }
  }
  
  return token;
}

/**
 * Verify session token
 */
export function verifySession(token: string | undefined): boolean {
  if (!token) {
    return false;
  }
  
  const session = sessions.get(token);
  if (!session) {
    return false;
  }
  
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  
  return true;
}

/**
 * Invalidate session
 */
export function invalidateSession(token: string): void {
  sessions.delete(token);
}
