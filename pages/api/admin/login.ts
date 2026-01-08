import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyPassword, createSession } from '@/lib/password-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const clientId = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(`admin-login:${clientId}`);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('X-RateLimit-Limit', String(30));
    res.setHeader('X-RateLimit-Remaining', String(rateLimitResult.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetTime / 1000)));
    return res.status(429).json({ 
      error: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
    });
  }

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  try {
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Verify password
    if (!verifyPassword(password)) {
      console.warn(`Failed login attempt from ${clientId}`);
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Create session
    const sessionToken = createSession();

    // Set HTTP-only cookie
    res.setHeader('Set-Cookie', `admin_session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${24 * 60 * 60}`);

    console.log(`Successful admin login from ${clientId}`);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}
