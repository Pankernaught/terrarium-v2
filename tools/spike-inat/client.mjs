/**
 * M0 spike — throwaway; do not import from app code.
 *
 * A courteous, throttled JSON client over the public iNaturalist API. Captures the
 * rate-limit + cache response headers each call (that IS one of the spike's
 * questions), throttles to stay well under 1 rps, and retries once on 429/5xx with a
 * short backoff. No auth, no user data, read-only.
 */

const BASE = 'https://api.inaturalist.org';
const UA = 'terrarium-v2-m0-spike/0.1 (github.com/Pankernaught/terrarium-v2; care-app migration spike)';
const MIN_GAP_MS = 1200; // ~0.83 rps ceiling

let lastAt = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Headers worth reporting for the rate-behavior + cacheability questions. */
const HEADER_KEYS = [
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'retry-after',
  'etag',
  'cache-control',
  'age',
  'x-cache',
  'cf-cache-status',
];

function pickHeaders(headers) {
  const out = {};
  for (const k of HEADER_KEYS) {
    const v = headers.get(k);
    if (v != null) out[k] = v;
  }
  return out;
}

/**
 * GET a JSON path (relative to the API host). Returns
 * `{ ok, status, ms, headers, json | error }` — never throws for an HTTP or network
 * error, so a probe can record a failure and carry on.
 */
export async function getJson(path, { retryOn = [429, 500, 502, 503, 504] } = {}) {
  const gap = MIN_GAP_MS - (Date.now() - lastAt);
  if (gap > 0) await sleep(gap);

  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      lastAt = Date.now();
      const ms = lastAt - started;
      const headers = pickHeaders(res.headers);
      if (retryOn.includes(res.status) && attempt === 0) {
        const wait = Number(headers['retry-after']) * 1000 || 2000;
        await sleep(wait);
        continue;
      }
      let json = null;
      try {
        json = await res.json();
      } catch {
        /* non-JSON body — leave null */
      }
      return { ok: res.ok, status: res.status, ms, headers, json };
    } catch (err) {
      lastAt = Date.now();
      if (attempt === 0) {
        await sleep(1500);
        continue;
      }
      return { ok: false, status: 0, ms: Date.now() - started, headers: {}, error: String(err) };
    }
  }
  return { ok: false, status: 0, ms: 0, headers: {}, error: 'unreachable' };
}

/**
 * Probe an endpoint with **no retry** and report the raw outcome — used for the CV
 * endpoint, where a 401/403 is the *answer* (what access it requires), not a failure
 * to retry around.
 */
export async function probe(path, init = {}) {
  const gap = MIN_GAP_MS - (Date.now() - lastAt);
  if (gap > 0) await sleep(gap);
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) },
    });
    lastAt = Date.now();
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, ms: lastAt - started, headers: pickHeaders(res.headers), json: body };
  } catch (err) {
    lastAt = Date.now();
    return { ok: false, status: 0, ms: Date.now() - started, headers: {}, error: String(err) };
  }
}

export { BASE, UA };
