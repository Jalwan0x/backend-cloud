import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateAdmin, setAuthCookie } from '@/lib/admin-auth';

/**
 * POST /api/admin/login
 * Clean replacement of previous login handler.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    const token = authenticateAdmin(password);

    if (!token) {
      console.warn('[Admin Login] Failed attempt');
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Success: Set Cookie
    setAuthCookie(res, token);
    console.log('[Admin Login] Success');

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Admin Login] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
