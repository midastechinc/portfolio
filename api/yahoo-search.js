/**
 * Vercel proxy for Yahoo Finance symbol search (browser CORS blocks github.io → Yahoo).
 * Optional: set env ALPHA_VANTAGE_KEY (free key from alphavantage.co) — used if Yahoo blocks the server.
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

  let raw = (req.query && req.query.q) != null ? String(req.query.q) : '';
  if (!raw && req.url) {
    try {
      const u = new URL(req.url, 'http://localhost');
      raw = u.searchParams.get('q') || '';
    } catch (e) {
      raw = '';
    }
  }
  const q = raw.trim();
  if (!q || q.length > 80) {
    res.status(400).json({ error: { message: 'Missing or invalid q' } });
    return;
  }

  const qEnc = encodeURIComponent(q);
  const suffix = 'quotesCount=18&newsCount=0';
  const candidates = [
    `https://query2.finance.yahoo.com/v1/finance/search?q=${qEnc}&${suffix}`,
    `https://query1.finance.yahoo.com/v1/finance/search?q=${qEnc}&${suffix}`,
  ];

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://finance.yahoo.com/',
  };

  try {
    let lastStatus = 502;
    let lastBody = { error: { message: 'Yahoo search returned no usable JSON' } };
    for (let i = 0; i < candidates.length; i++) {
      const r = await fetch(candidates[i], { headers });
      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (pe) {
        lastStatus = r.status || 502;
        lastBody = { error: { message: 'Yahoo returned non-JSON (blocked or rate-limited)' } };
        continue;
      }
      if (r.ok && data && typeof data === 'object') {
        res.status(200).json(data);
        return;
      }
      lastStatus = r.status;
      lastBody = data && typeof data === 'object' ? data : { error: { message: 'HTTP ' + r.status } };
    }
    const avKey = (process.env.ALPHA_VANTAGE_KEY || '').trim();
    if (avKey.length >= 8) {
      try {
        const avUrl =
          'https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=' +
          encodeURIComponent(q) +
          '&apikey=' +
          encodeURIComponent(avKey);
        const ar = await fetch(avUrl);
        const aj = await ar.json().catch(() => null);
        const bm = aj && aj.bestMatches;
        if (ar.ok && Array.isArray(bm) && bm.length) {
          const quotes = bm.map((m) => ({
            symbol: m['1. symbol'] || m.symbol,
            shortname: m['2. name'] || '',
            longname: m['2. name'] || '',
            exchDisp: m['4. region'] || '',
            exchange: m['4. region'] || '',
            quoteType: 'EQUITY',
            type: 'EQUITY',
          }));
          res.status(200).json({ quotes });
          return;
        }
      } catch (avErr) {
        lastBody = { error: { message: avErr.message || 'Alpha Vantage fallback failed' } };
      }
    }

    res.status(lastStatus >= 400 ? lastStatus : 502).json(lastBody);
  } catch (e) {
    res.status(502).json({ error: { message: e.message || 'Upstream fetch failed' } });
  }
};
