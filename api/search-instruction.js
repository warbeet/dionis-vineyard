// Vercel Serverless Function: /api/search-instruction
// Безопасный proxy для поиска инструкций препаратов через Tavily.
// ENV: TAVILY_API_KEY=tvly-...

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TAVILY_API_KEY is not configured' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const productName = String(body.productName || '').trim();
    const query = String(body.query || `официальная инструкция препарат ${productName} виноград регламент применения действующее вещество срок ожидания`).trim();
    if (!productName && !query) return res.status(400).json({ error: 'productName or query is required' });

    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: body.search_depth || 'advanced',
        include_answer: true,
        include_raw_content: false,
        max_results: Math.min(Number(body.max_results || 8), 12),
        include_domains: body.include_domains || [
          'agro.basf.ru',
          'agroxxi.ru',
          'mcx.gov.ru',
          'agromax.pro',
          'avgust.com',
          'syngenta.ru',
          'cropscience.bayer.ru'
        ]
      })
    });

    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: text.slice(0, 500) });
    const data = JSON.parse(text);
    const results = (data.results || []).map(x => ({
      title: x.title || x.url,
      url: x.url,
      content: x.content || x.raw_content || ''
    }));

    return res.status(200).json({
      provider: 'tavily',
      productName,
      query,
      answer: data.answer || '',
      results
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
