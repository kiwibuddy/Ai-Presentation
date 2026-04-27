import { preflight, setCors } from './_util.js';

export default function handler(req, res) {
  if (preflight(req, res)) return;
  setCors(req, res);
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    ok: true,
    hasEleven: Boolean(process.env.ELEVENLABS_API_KEY),
    hasFal: Boolean(process.env.FAL_KEY),
  });
}
