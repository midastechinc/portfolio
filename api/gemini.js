/**
 * Vercel proxy for Google Gemini API (free tier friendly; use on GitHub Pages like api/anthropic.js).
 *
 * Env: GEMINI_API_KEY — from https://aistudio.google.com/apikey
 * Optional: GEMINI_MODEL (default gemini-2.0-flash)
 *
 * POST JSON body: { model?, contents, generationConfig?, tools? }
 * `model` is stripped before forwarding; Google expects it only in the URL path.
 */

module.exports = async (req, res) => {
  const reqOrigin = req.headers.origin || '';
  const configured = (process.env.ALLOW_ORIGIN || '').trim();
  const strict = process.env.CORS_STRICT === '1';
  let allow = '*';
  if (strict && configured) {
    const list = configured.split(',').map((s) => s.trim()).filter(Boolean);
    if (reqOrigin && list.includes(reqOrigin)) allow = reqOrigin;
    else if (list.length === 1) allow = list[0];
    else if (list.includes('*')) allow = '*';
  }
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'POST only' } });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: 'Server missing GEMINI_API_KEY' } });
    return;
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body != null ? req.body : {});
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    res.status(400).json({ error: { message: 'Invalid JSON body' } });
    return;
  }

  const model = body.model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const forward = { ...body };
  delete forward.model;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forward),
    });
    const data = await r.json().catch(() => ({}));
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: { message: e.message || 'Upstream fetch failed' } });
  }
};
