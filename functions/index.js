// Firebase Functions v2 HTTP endpoint: searchInstruction
// ENV: firebase functions:secrets:set TAVILY_API_KEY
// Deploy: firebase deploy --only functions:searchInstruction

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const TAVILY_API_KEY = defineSecret('TAVILY_API_KEY');

export const searchInstruction = onRequest({ cors: true, secrets: [TAVILY_API_KEY] }, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = TAVILY_API_KEY.value();
  if (!apiKey) return res.status(500).json({ error: 'TAVILY_API_KEY is not configured' });

  try {
    const body = req.body || {};
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

    return res.status(200).json({ provider: 'tavily', productName, query, answer: data.answer || '', results });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
});
