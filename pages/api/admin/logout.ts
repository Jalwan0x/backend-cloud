import type { NextApiRequest, NextApiResponse } from 'next';
import { invalidateSession } from '@/lib/password-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse cookies from request headers
  const cookies = req.headers.cookie || '';
  const cookieMatch = cookies.match(/admin_session=([^;]+)/);
  const sessionToken = cookieMatch ? cookieMatch[1] : undefined;
  
  if (sessionToken) {
    invalidateSession(sessionToken);
  }

  // Clear cookie
  res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');

  res.status(200).json({ success: true });
}
