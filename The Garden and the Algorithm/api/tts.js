import { getClientIP, preflight, rateLimit, setCors } from './_util.js';

/**
 * POST JSON: { voiceId, text }
 * Returns: audio/mpeg
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  setCors(req, res);
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const ip = getClientIP(req);
  if (!rateLimit(ip, 20, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'ELEVENLABS_API_KEY not set' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  const { voiceId, text } = body || {};
  if (!voiceId || !text) {
    return res.status(400).json({ error: 'voiceId and text required' });
  }

  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(String(voiceId))}/stream`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: String(text).slice(0, 2500),
        model_id: 'eleven_flash_v2_5',
      }),
    }
  );

  if (!r.ok) {
    const err = await r.text();
    return res.status(r.status).send(err);
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  const ab = await r.arrayBuffer();
  return res.status(200).send(Buffer.from(ab));
}
