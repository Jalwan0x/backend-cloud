import crypto from 'crypto';

export function verifyWebhook(
  data: string,
  hmacHeader: string
): boolean {
  if (!hmacHeader) {
    return false;
  }

  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    return false;
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(data, 'utf8')
    .digest('base64');

  return hash === hmacHeader;
}

export function verifyAppProxyRequest(
  query: Record<string, string | string[]>
): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    return false;
  }

  const hmac = query.hmac as string;
  if (!hmac) {
    return false;
  }

  // Remove hmac and signature from query for verification
  const { hmac: _, signature: __, ...params } = query;
  
  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${Array.isArray(params[key]) ? params[key][0] : params[key]}`)
    .join('&');

  const hash = crypto
    .createHmac('sha256', secret)
    .update(message, 'utf8')
    .digest('hex');

  return hash === hmac;
}
