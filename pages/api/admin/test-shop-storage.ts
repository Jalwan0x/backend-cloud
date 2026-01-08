import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { verifySession } from '@/lib/password-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Verify password-based session
  const cookies = req.headers.cookie || '';
  const cookieMatch = cookies.match(/admin_session=([^;]+)/);
  const sessionToken = cookieMatch ? cookieMatch[1] : undefined;
  
  if (!verifySession(sessionToken)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  try {
    const { shopDomain } = req.body;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'shopDomain is required' });
    }

    // Test shop storage
    const shopifyId = shopDomain.replace('.myshopify.com', '');
    
    console.log(`[Test Shop Storage] Attempting to upsert shop: ${shopDomain}`);
    
    const result = await prisma.shop.upsert({
      where: { shopDomain },
      update: {
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        shopDomain,
        shopifyId,
        accessToken: 'test-token-encrypted',
        scopes: 'test-scopes',
        isActive: true,
      },
    });

    console.log(`[Test Shop Storage] Shop stored successfully: ${result.id}`);

    // Verify it was stored
    const verify = await prisma.shop.findUnique({
      where: { shopDomain },
    });

    res.json({
      success: true,
      shop: result,
      verified: !!verify,
      message: 'Test shop storage successful',
    });
  } catch (error: any) {
    console.error('[Test Shop Storage] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to store shop',
      details: error.stack,
    });
  }
}
