import type { NextApiRequest, NextApiResponse } from 'next';
import { verifySession } from '@/lib/password-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Verify password-based session
  const cookies = req.headers.cookie || '';
  const cookieMatch = cookies.match(/admin_session=([^;]+)/);
  const sessionToken = cookieMatch ? cookieMatch[1] : undefined;
  
  if (!verifySession(sessionToken)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const shop = req.query.shop as string;
  if (!shop) {
    return res.status(400).json({ 
      error: 'Shop parameter is required',
      example: '/api/admin/trigger-oauth?shop=your-shop.myshopify.com'
    });
  }

  // Normalize shop domain
  let normalizedShop = shop.toLowerCase().trim();
  if (!normalizedShop.includes('.myshopify.com')) {
    normalizedShop = `${normalizedShop}.myshopify.com`;
  }

  // Redirect to OAuth begin
  const oauthUrl = `/api/auth/begin?shop=${encodeURIComponent(normalizedShop)}`;
  res.redirect(oauthUrl);
}
