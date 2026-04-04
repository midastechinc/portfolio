/**
 * Vercel serverless proxy for Claude API (fixes browser CORS on GitHub Pages).
 *
 * Deploy: connect this repo to Vercel, set env ANTHROPIC_API_KEY, deploy.
 * CORS: defaults to * (works from GitHub Pages). Set CORS_STRICT=1 and
 * ALLOW_ORIGIN=https://midastechinc.github.io to restrict (must match browser Origin exactly).
 *
 * Portfolio console (after deploy):
 * localStorage.setItem("mt-anthropic-proxy", "https://YOUR-PROJECT.vercel.app/api/anthropic")
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, anthropic-version');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { type: 'method', message: 'POST only' } });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { type: 'config', message: 'Server missing ANTHROPIC_API_KEY' } });
    return;
  }

  const payload =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body != null ? req.body : {});

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
      },
      body: payload,
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: { type: 'proxy', message: e.message || 'Upstream fetch failed' } });
  }
};
