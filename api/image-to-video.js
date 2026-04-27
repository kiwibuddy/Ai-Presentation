import { getClientIP, preflight, rateLimit, setCors } from './_util.js';

const QUEUE = 'https://queue.fal.run';
const MODEL_SEEDANCE = 'bytedance/seedance-2.0/image-to-video';
const MODEL_KLING = 'fal-ai/kling-video/v1/standard/image-to-video';
const MODEL_FLUX = 'fal-ai/flux/dev';

function pickVideoUrl(obj) {
  if (!obj) return null;
  const o = obj.data != null ? obj.data : obj;
  if (o?.video?.url) return o.video.url;
  if (o?.videos?.[0]?.url) return o.videos[0].url;
  if (o?.output?.url) return o.output.url;
  if (o?.[0]?.url) return o[0].url;
  return o?.url || null;
}

function pickImageUrl(obj) {
  if (!obj) return null;
  const o = obj.data != null ? obj.data : obj;
  if (o?.images?.[0]?.url) return o.images[0].url;
  if (o?.image?.url) return o.image.url;
  if (o?.[0]?.url) return o[0].url;
  return null;
}

/**
 * POST: submit { imageBase64, prompt, mode?: 'i2v'|'img', engine?: 'seedance'|'kling' }
 * GET: ?requestId=&model= (url-encoded model id) — status + result when done
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  setCors(req, res);
  const key = process.env.FAL_KEY;
  if (!key) {
    return res.status(503).json({ error: 'FAL_KEY not set' });
  }
  const ip = getClientIP(req);
  if (!rateLimit(ip, 6, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  if (req.method === 'GET') {
    const requestId = req.query.requestId;
    const model = req.query.model;
    if (!requestId || !model) {
      return res.status(400).json({ error: 'requestId and model (query) are required' });
    }
    const m = String(model);
    const base = `${QUEUE}/${m}/requests/${encodeURIComponent(String(requestId))}`;

    const st = await fetch(`${base}/status`, {
      headers: { Authorization: `Key ${key}` },
    });
    const stJson = await st.json().catch(() => ({}));
    if (!st.ok) {
      return res.status(st.status).json({ error: 'status error', raw: stJson });
    }

    if (stJson.status === 'COMPLETED') {
      const rUrl = stJson.response_url || `${base}/response`;
      const r2 = await fetch(rUrl, { headers: { Authorization: `Key ${key}` } });
      const out = await r2.json().catch(() => ({}));
      if (!r2.ok) {
        return res.status(r2.status).json({ error: 'result fetch failed', raw: out });
      }
      return res.status(200).json({
        done: true,
        videoUrl: pickVideoUrl(out),
        imageUrl: pickImageUrl(out),
        raw: out,
      });
    }
    return res.status(200).json({
      done: false,
      state: stJson.status,
      queuePosition: stJson.queue_position,
      raw: stJson,
    });
  }

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const { imageBase64, prompt, mode = 'i2v', engine = 'seedance' } = body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 required' });
  }
  const dataUrl = String(imageBase64).startsWith('data:') ? String(imageBase64) : `data:image/jpeg;base64,${imageBase64}`;

  if (mode === 'img') {
    const m = MODEL_FLUX;
    const r = await fetch(`${QUEUE}/${m}`, {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          prompt: String(prompt || 'cinematic restyle, detailed').slice(0, 2000),
          image_url: dataUrl,
        },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ error: j, raw: j });
    }
    return res.status(200).json({
      requestId: j.request_id,
      model: m,
    });
  }

  const m = engine === 'kling' ? MODEL_KLING : MODEL_SEEDANCE;
  const input =
    m === MODEL_KLING
      ? { prompt: String(prompt || '').slice(0, 2000), image_url: dataUrl, duration: '5' }
      : {
          prompt: String(prompt || '').slice(0, 2000),
          image_url: dataUrl,
          resolution: '720p',
          duration: '5',
        };

  const r = await fetch(`${QUEUE}/${m}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    return res.status(r.status).json({ error: j, raw: j });
  }
  return res.status(200).json({ requestId: j.request_id, model: m });
}
