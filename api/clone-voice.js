import { getClientIP, preflight, rateLimit, setCors } from './_util.js';

/**
 * POST JSON: { audioBase64, mime?: string, name?: string }
 * Returns: { voiceId: string }
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  setCors(req, res);
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const ip = getClientIP(req);
  if (!rateLimit(ip, 8, 60_000)) {
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

  const { audioBase64, mime: mimeIn = 'audio/webm', name: voiceName = 'GRLiveSession' } = body || {};
  if (!audioBase64) {
    return res.status(400).json({ error: 'audioBase64 required' });
  }

  const b64 = String(audioBase64).replace(/^data:[^;]+;base64,/, '');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 200) {
    return res.status(400).json({ error: 'Audio too short' });
  }
  if (buf.length > 6 * 1024 * 1024) {
    return res.status(400).json({ error: 'Audio too large' });
  }

  const mime = mimeIn.includes('webm') ? 'audio/webm' : mimeIn.includes('wav') ? 'audio/wav' : 'audio/mpeg';
  const ext = mime.includes('webm') ? 'webm' : mime.includes('wav') ? 'wav' : 'mp3';

  const form = new FormData();
  form.append('name', String(voiceName).slice(0, 64));
  form.append('files', new Blob([buf], { type: mime }), `sample.${ext}`);

  const r = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    return res.status(r.status).json({ error: j.detail || j.message || 'ElevenLabs add voice failed', raw: j });
  }

  const voiceId = j.voice_id;
  if (!voiceId) {
    return res.status(502).json({ error: 'No voice_id in response', raw: j });
  }

  setTimeout(() => {
    fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': key },
    }).catch(() => {});
  }, 5 * 60 * 1000);

  return res.status(200).json({ voiceId });
}
