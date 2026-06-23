// Firebase Functions v2 HTTP endpoint: searchInstruction
// Безопасный proxy для поиска инструкций препаратов через Tavily.
// Secret: firebase functions:secrets:set TAVILY_API_KEY
// Optional ENV: ALLOWED_ORIGIN=https://warbeet.github.io[,http://localhost:...]
// Deploy: firebase deploy --only functions:searchInstruction

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const TAVILY_API_KEY = defineSecret('TAVILY_API_KEY');

const PROXY_VERSION = '0.7.8';
const DEFAULT_ALLOWED_ORIGINS = [
  'https://warbeet.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

const TRUSTED_MANUFACTURER_DOMAINS = [
  'agro.basf.ru',
  'avgust.com',
  'syngenta.ru',
  'cropscience.bayer.ru',
  'cropscience.bayer.com',
  'fmc.com',
  'fmcagro.ru',
  'adama.com',
  'adama-russia.ru',
  'corteva.ru',
  'shchelkovoagrochim.com',
  'betaren.ru',
  'lidea-seeds.ru',
  'upl-ltd.com',
  'summit-agro.ru'
];

const REGISTRY_AND_REFERENCE_DOMAINS = [
  'mcx.gov.ru',
  'pesticidy.ru',
  'agroxxi.ru',
  'agromax.pro'
];

const rateLimitStore = new Map();

function getAllowedOrigins() {
  const configured = String(process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(origin) {
  if (!origin) return true; // server-to-server checks do not send Origin
  const allowed = getAllowedOrigins();
  return allowed.includes('*') || allowed.includes(origin);
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = getAllowedOrigins();
  const allowOrigin = isOriginAllowed(origin) ? (origin || allowed[0] || '*') : 'null';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function getClientIp(req) {
  return String(
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  ).split(',')[0].trim();
}

function checkRateLimit(req) {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 30);
  const key = getClientIp(req);
  const bucket = rateLimitStore.get(key) || { resetAt: now + windowMs, count: 0 };
  if (now > bucket.resetAt) {
    bucket.resetAt = now + windowMs;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateLimitStore.set(key, bucket);

  for (const [k, v] of rateLimitStore.entries()) {
    if (now > v.resetAt + windowMs) rateLimitStore.delete(k);
  }

  return {
    ok: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetSeconds: Math.ceil((bucket.resetAt - now) / 1000)
  };
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body;
}

function cleanText(value, max = 160) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizeForMatch(value) {
  return cleanText(value, 5000)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

function domainMatches(host, domains) {
  return domains.some(d => host === d || host.endsWith('.' + d));
}

function buildQueries(productName, userQuery) {
  const quoted = productName ? `"${productName}"` : '';
  const base = userQuery || `официальная инструкция препарат ${productName} регламент применения действующее вещество срок ожидания виноград`;
  return [
    cleanText(base, 260),
    cleanText(`${quoted} инструкция регламент применения действующее вещество срок ожидания виноград`, 260),
    cleanText(`${quoted} официальный сайт производителя препарат инструкция`, 260)
  ].filter(Boolean);
}

async function tavilySearch(apiKey, { query, include_domains, max_results }) {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      include_answer: true,
      include_raw_content: false,
      max_results,
      include_domains
    })
  });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error(text.slice(0, 500));
    err.status = r.status;
    throw err;
  }
  return JSON.parse(text || '{}');
}

function dedupeResults(results) {
  const seen = new Set();
  const out = [];
  for (const x of results || []) {
    const url = String(x.url || '').split('#')[0];
    const key = url || `${x.title || ''}|${String(x.content || '').slice(0, 80)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...x, url });
  }
  return out;
}

function scoreResult(x, productName) {
  const title = cleanText(x.title || x.url, 300);
  const url = String(x.url || '');
  const host = hostnameOf(url);
  const content = cleanText(x.content || x.raw_content || '', 2600);
  const hayTitle = normalizeForMatch(title);
  const hayUrl = normalizeForMatch(url);
  const hayContent = normalizeForMatch(content);
  const needle = normalizeForMatch(productName);

  let score = 0;
  const reasons = [];
  const productTokens = needle.split(' ').filter(t => t.length >= 3);
  const productHit = needle && (
    hayTitle.includes(needle) || hayUrl.includes(needle) || hayContent.includes(needle) ||
    productTokens.some(t => hayTitle.includes(t) || hayUrl.includes(t))
  );

  if (needle && hayTitle.includes(needle)) { score += 70; reasons.push('product_in_title'); }
  else if (productTokens.some(t => hayTitle.includes(t))) { score += 45; reasons.push('product_token_in_title'); }
  if (needle && hayUrl.includes(needle)) { score += 35; reasons.push('product_in_url'); }
  if (needle && hayContent.includes(needle)) { score += 25; reasons.push('product_in_content'); }

  if (domainMatches(host, TRUSTED_MANUFACTURER_DOMAINS)) { score += 40; reasons.push('manufacturer_domain'); }
  else if (domainMatches(host, REGISTRY_AND_REFERENCE_DOMAINS)) { score += 20; reasons.push('reference_domain'); }

  if (/инструкц|регламент|применен|действующ|веществ|срок ожидан|норма расход|кратность/i.test(`${title} ${content}`)) {
    score += 25; reasons.push('instruction_terms');
  }
  if (/виноград|оидиум|милдью|лоза|ягод/i.test(`${title} ${content}`)) {
    score += 12; reasons.push('grape_terms');
  }
  if (/\.pdf(\?|$)/i.test(url)) { score += 5; reasons.push('pdf'); }
  if (!productHit && productName) { score -= 45; reasons.push('weak_product_match'); }
  if (/[\u0000-\u001f]/.test(String(x.content || ''))) { score -= 10; reasons.push('noisy_content'); }

  const sourceType = /\.pdf(\?|$)/i.test(url) ? 'pdf' : 'html';
  return {
    title: title || url || 'Источник',
    url,
    content,
    domain: host,
    source_type: sourceType,
    trusted: domainMatches(host, TRUSTED_MANUFACTURER_DOMAINS),
    score,
    reasons
  };
}

function rankResults(results, productName, maxResults) {
  const scored = dedupeResults(results)
    .map(x => scoreResult(x, productName))
    .filter(x => x.url || x.content)
    .sort((a, b) => b.score - a.score);

  const strong = scored.filter(x => x.score >= 25);
  return (strong.length ? strong : scored).slice(0, maxResults);
}

async function handleSearchInstruction(req, res, apiKey) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!isOriginAllowed(req.headers.origin || '')) return res.status(403).json({ error: 'Origin is not allowed' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = checkRateLimit(req);
  res.setHeader('X-RateLimit-Limit', String(rl.limit));
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  if (!rl.ok) return res.status(429).json({ error: 'Too many requests', retryAfter: rl.resetSeconds });

  if (!apiKey) return res.status(500).json({ error: 'TAVILY_API_KEY is not configured' });

  try {
    const body = parseBody(req);
    const productName = cleanText(body.productName, 120);
    const query = cleanText(body.query, 260);
    const maxResults = Math.min(Math.max(Number(body.max_results || 7), 3), 10);
    if (!productName && !query) return res.status(400).json({ error: 'productName or query is required' });

    const queries = buildQueries(productName, query);
    const primaryDomains = Array.isArray(body.include_domains) && body.include_domains.length
      ? body.include_domains.map(d => cleanText(d, 80)).filter(Boolean)
      : [...TRUSTED_MANUFACTURER_DOMAINS, ...REGISTRY_AND_REFERENCE_DOMAINS];

    const collected = [];
    const usedQueries = [];
    let answer = '';

    const first = await tavilySearch(apiKey, {
      query: queries[0],
      include_domains: primaryDomains,
      max_results: Math.min(maxResults + 3, 12)
    });
    usedQueries.push(queries[0]);
    answer = first.answer || '';
    collected.push(...(first.results || []));

    let ranked = rankResults(collected, productName, maxResults);

    if (ranked.length < 3 && queries[1] && queries[1] !== queries[0]) {
      const second = await tavilySearch(apiKey, {
        query: queries[1],
        include_domains: primaryDomains,
        max_results: Math.min(maxResults + 3, 12)
      });
      usedQueries.push(queries[1]);
      if (!answer) answer = second.answer || '';
      collected.push(...(second.results || []));
      ranked = rankResults(collected, productName, maxResults);
    }

    const trustedCount = ranked.filter(r => r.trusted).length;
    const warnings = [];
    if (!trustedCount) warnings.push('Не найдено источников на доменах производителей; проверьте данные вручную.');
    if (ranked.length < 3) warnings.push('Найдено мало источников; попробуйте уточнить название препарата.');

    return res.status(200).json({
      provider: 'tavily-proxy',
      proxyVersion: PROXY_VERSION,
      productName,
      query: queries[0],
      usedQueries,
      answer,
      results: ranked,
      source_quality: {
        totalCollected: dedupeResults(collected).length,
        returned: ranked.length,
        trusted: trustedCount,
        domains: [...new Set(ranked.map(r => r.domain).filter(Boolean))],
        warnings
      }
    });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || String(e) });
  }
}


export const searchInstruction = onRequest({ cors: false, secrets: [TAVILY_API_KEY] }, async (req, res) => {
  return handleSearchInstruction(req, res, TAVILY_API_KEY.value());
});
