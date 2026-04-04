/**
 * Vercel proxy for Yahoo Finance symbol search (browser CORS blocks github.io → Yahoo).
 * No secrets required. Deploy with the rest of api/*.
 * CORS: same defaults as api/anthropic.js (open * unless CORS_STRICT=1 + ALLOW_ORIGIN).
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: { message: 'GET only' } });
    return;
  }

  const raw = (req.query && req.query.q) != null ? String(req.query.q) : '';
  const q = raw.trim();
  if (!q || q.length > 80) {
    res.status(400).json({ error: { message: 'Missing or invalid q' } });
    return;
  }

  const yUrl =
    'https://query2.finance.yahoo.com/v1/finance/search?q=' +
    encodeURIComponent(q) +
    '&quotesCount=18&newsCount=0';

  try {
    const r = await fetch(yUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MidasPortfolio/1.0)',
        Accept: 'application/json',
      },
    });
    const data = await r.json().catch(() => ({}));
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: { message: e.message || 'Upstream fetch failed' } });
  }
};
