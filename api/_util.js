/**
 * Shared helpers for Vercel serverless routes (Node runtime).
 */
const buckets = new Map();

export function getClientIP(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff[0]) return xff[0].split(',')[0].trim();
  return req.socket?.remoteAddress || 'local';
}

/** Simple sliding-window limiter: max n requests per windowMs per IP. */
export function rateLimit(ip, max = 12, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(ip) || [];
  const keep = b.filter((t) => now - t < windowMs);
  if (keep.length >= max) return false;
  keep.push(now);
  buckets.set(ip, keep);
  return true;
}

export function allowedOrigin(req) {
  const o = req.headers.origin;
  if (!o) {
    try {
      if (req.headers.referer) return new URL(req.headers.referer).origin;
    } catch { /* */ }
    return '*';
  }
  const list = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (list.some((a) => o.startsWith(a))) return o;
  if (o.includes('vercel.app')) return o;
  if (o.startsWith('http://localhost') || o.startsWith('http://127.0.0.1') || o.startsWith('file://')) return o;
  if (o === 'https://ai-and-discipleship.vercel.app') return o;
  return o;
}

export function setCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function preflight(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
