import { getClientIP, preflight, rateLimit, setCors } from './_util.js';

let scanCount = 0;

export default function handler(req, res) {
  if (preflight(req, res)) return;
  setCors(req, res);
  const ip = getClientIP(req);
  if (!rateLimit(ip, 30, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  if (req.method === 'GET') {
    return res.status(200).json({ count: scanCount });
  }
  if (req.method === 'POST') {
    scanCount += 1;
    return res.status(200).json({ count: scanCount });
  }
  res.status(405).end();
}
