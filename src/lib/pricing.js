export const PRICING_CACHE_KEY = 'pricing_table_cache'

export const HARDCODED_PRICING = {
  'gpt-5': { prompt: 0.00125, cached: 0.000125, completion: 0.010 },
  'gpt-5-mini': { prompt: 0.00025, cached: 0.000025, completion: 0.002 },
  'gpt-5-nano': { prompt: 0.00005, cached: 0.000005, completion: 0.0004 },
  'gpt-5-chat-latest': { prompt: 0.00125, cached: 0.000125, completion: 0.010 },
  'gpt-4.1': { prompt: 0.002, cached: 0.0005, completion: 0.008 },
  'gpt-4.1-mini': { prompt: 0.0004, cached: 0.0001, completion: 0.0016 },
  'gpt-4.1-nano': { prompt: 0.0001, cached: 0.000025, completion: 0.0004 },
  'gpt-4o': { prompt: 0.0025, cached: 0.00125, completion: 0.010 },
  'gpt-4o-2024-05-13': { prompt: 0.005, completion: 0.015 },
  'gpt-4o-mini': { prompt: 0.00015, cached: 0.000075, completion: 0.0006 },
  'gpt-realtime': { prompt: 0.004, cached: 0.0004, completion: 0.016 },
  'gpt-4o-realtime-preview': { prompt: 0.005, cached: 0.0025, completion: 0.020 },
  'gpt-4o-mini-realtime-preview': { prompt: 0.0006, cached: 0.0003, completion: 0.0024 },
  'gpt-audio': { prompt: 0.0025, completion: 0.010 },
  'gpt-4o-audio-preview': { prompt: 0.0025, completion: 0.010 },
  'gpt-4o-mini-audio-preview': { prompt: 0.00015, completion: 0.0006 },
  'o1': { prompt: 0.015, cached: 0.0075, completion: 0.060 },
  'o1-pro': { prompt: 0.150, completion: 0.600 },
  'o3-pro': { prompt: 0.020, completion: 0.080 },
  'o3': { prompt: 0.002, cached: 0.0005, completion: 0.008 },
  'o3-deep-research': { prompt: 0.010, cached: 0.0025, completion: 0.040 },
  'o4-mini': { prompt: 0.00110, cached: 0.000275, completion: 0.00440 },
  'o4-mini-deep-research': { prompt: 0.0020, cached: 0.0005, completion: 0.0080 },
  'o3-mini': { prompt: 0.00110, cached: 0.00055, completion: 0.00440 },
  'o1-mini': { prompt: 0.00110, cached: 0.00055, completion: 0.00440 },
  'codex-mini-latest': { prompt: 0.00150, cached: 0.000375, completion: 0.00600 },
  'gpt-4o-mini-search-preview': { prompt: 0.00015, completion: 0.0006 },
  'gpt-4o-search-preview': { prompt: 0.0025, completion: 0.010 },
  'computer-use-preview': { prompt: 0.003, completion: 0.012 },
  'gpt-image-1': { prompt: 0.005 },
}

export function readPricingCache(key = PRICING_CACHE_KEY) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
    return null
  } catch {
    return null
  }
}

export function writePricingCache(data, key = PRICING_CACHE_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function parsePricingTable(raw) {
  if (!raw) return null
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export async function fetchPricingTable(url, fetchImpl = fetch) {
  if (!url) return null
  try {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  }
}

export async function ensurePricingTable(url, { ttl = 24 * 60 * 60 * 1000, fetchImpl = fetch } = {}) {
  const now = Date.now()
  const cached = readPricingCache()
  if (url && cached && cached.url === url && cached.fetchedAt && (now - cached.fetchedAt) < ttl && cached.table) {
    return { table: cached.table, fromCache: true }
  }

  if (!url) {
    return { table: cached?.table || null, fromCache: !!cached }
  }

  const remote = await fetchPricingTable(url, fetchImpl)
  if (remote) {
    writePricingCache({ url, fetchedAt: now, table: remote })
    return { table: remote, fromCache: false }
  }

  return { table: cached?.table || null, fromCache: !!cached }
}

export function getPricingTable({ preferred, cached, envTable, fallback = HARDCODED_PRICING } = {}) {
  if (preferred && typeof preferred === 'object') return preferred

  const cachedTable = cached ?? readPricingCache()?.table
  if (cachedTable && typeof cachedTable === 'object') return cachedTable

  const envResolved = typeof envTable === 'string' ? parsePricingTable(envTable) : envTable
  if (envResolved && typeof envResolved === 'object') return envResolved

  return fallback
}

export function estimateCostUSD(modelId, usage, table = null) {
  try {
    if (!usage) return NaN
    const resolvedTable = table && typeof table === 'object'
      ? table
      : getPricingTable({ preferred: table })
    if (!resolvedTable) return NaN

    const key = String(modelId || '')
    const lower = key.toLowerCase()
    let entry = resolvedTable[key] || resolvedTable[lower] || null
    if (!entry) {
      const noDate = lower.replace(/-20\d{2}-\d{2}-\d{2}.*/, '')
      entry = resolvedTable[noDate] || entry
    }
    if (!entry) {
      const candidates = [
        lower.replace(/-latest$/, ''),
        lower.replace(/-preview$/, ''),
        lower.replace(/-chat-latest$/, ''),
      ].filter(Boolean)
      for (const c of candidates) {
        if (resolvedTable[c]) { entry = resolvedTable[c]; break }
      }
    }
    if (!entry) {
      const keys = Object.keys(resolvedTable)
      let best = ''
      for (const k of keys) {
        const kl = k.toLowerCase()
        if (lower.startsWith(kl) && kl.length > best.length) best = k
      }
      if (best) entry = resolvedTable[best]
    }
    if (!entry || (entry.prompt == null && entry.input == null)) return NaN
    const promptRate = Number(entry.prompt ?? entry.input)
    const completionRate = Number(entry.completion ?? entry.output ?? entry.prompt ?? entry.input)
    if (!(promptRate >= 0) || !(completionRate >= 0)) return NaN
    const pt = Number(usage.prompt_tokens || 0)
    const ct = Number(usage.completion_tokens || 0)
    const cost = (pt / 1000) * promptRate + (ct / 1000) * completionRate
    return Number.isFinite(cost) ? cost : NaN
  } catch {
    return NaN
  }
}

export default {
  PRICING_CACHE_KEY,
  HARDCODED_PRICING,
  readPricingCache,
  writePricingCache,
  parsePricingTable,
  fetchPricingTable,
  ensurePricingTable,
  getPricingTable,
  estimateCostUSD,
}
