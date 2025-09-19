import LZString from 'lz-string'

export function encodeShared(payload) {
  try {
    const json = JSON.stringify(payload)
    const compressed = LZString.compressToEncodedURIComponent(json)
    if (compressed && compressed.length > 0) return compressed

    const bytes = new TextEncoder().encode(json)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  } catch {
    return ''
  }
}

export function decodeShared(encoded) {
  if (!encoded) return null

  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (json && typeof json === 'string') return JSON.parse(json)
  } catch {
    // ignore
  }

  try {
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    const json = new TextDecoder().decode(bytes)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function getShareBase() {
  try {
    const base = import.meta.env.VITE_SHARE_BASE_URL || ''
    return base ? String(base).replace(/\/+$/g, '') : ''
  } catch {
    return ''
  }
}

export async function fetchSharedById(id, fetchImpl = fetch) {
  const base = getShareBase()
  if (!base || !id) return null

  try {
    const res = await fetchImpl(`${base}/share/${encodeURIComponent(id)}`)
    if (!res.ok) return null
    const body = await res.json().catch(() => null)
    if (!body) return null
    if (body && typeof body === 'object' && (body.kind || body.messages || body.run || body.tools)) return body
    if (body && typeof body === 'object' && body.data) return body.data
    return null
  } catch {
    return null
  }
}

export async function uploadSharedPayload(payload, fetchImpl = fetch) {
  const base = getShareBase()
  if (!base || !payload) return null

  try {
    const res = await fetchImpl(`${base}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const js = await res.json().catch(() => null)
      const id = js?.id || js?.uuid || js?.key
      if (typeof id === 'string' && id) return id
    }
  } catch {
    // ignore
  }

  try {
    const id = crypto.randomUUID()
    const put = await fetchImpl(`${base}/share/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (put.ok) return id
  } catch {
    // ignore
  }

  return null
}

function getShlinkConfig() {
  try {
    const base = import.meta.env.VITE_SHLINK_BASE_URL || ''
    const apiKey = import.meta.env.VITE_SHLINK_API_KEY || ''
    const domain = import.meta.env.VITE_SHLINK_DOMAIN || ''
    return {
      base: base ? String(base).replace(/\/+$/g, '') : '',
      apiKey: apiKey || '',
      domain: domain || '',
    }
  } catch {
    return { base: '', apiKey: '', domain: '' }
  }
}

export async function shortenWithShlink(longUrl, fetchImpl = fetch) {
  try {
    const { base, apiKey, domain } = getShlinkConfig()
    if (!base || !apiKey) return null
    const res = await fetchImpl(`${base}/rest/v3/short-urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({ longUrl, findIfExists: true, ...(domain ? { domain } : {}) }),
    })
    if (!res.ok) return null
    const js = await res.json().catch(() => null)
    if (!js) return null
    if (typeof js === 'string' && /^https?:\/\//i.test(js)) return js
    if (typeof js?.shortUrl === 'string' && /^https?:\/\//i.test(js.shortUrl)) return js.shortUrl
    if (js?.shortUrl && typeof js.shortUrl.shortUrl === 'string') return js.shortUrl.shortUrl
    if (js?.shortCode) {
      const host = domain || ((() => { try { return new URL(base).host } catch { return '' } })())
      if (host && js.shortCode) return `https://${host}/${js.shortCode}`
    }
    return null
  } catch {
    return null
  }
}

export async function shortenUrlIfConfigured(longUrl, fetchImpl = fetch) {
  try {
    const base = import.meta.env.VITE_SHORTENER_BASE || ''
    if (!base) return null
    const endpoint = `${String(base).replace(/\/+$/g, '')}?url=${encodeURIComponent(longUrl)}`
    const res = await fetchImpl(endpoint)
    if (!res.ok) return null
    const text = (await res.text()).trim()
    if (text && /^https?:\/\//i.test(text)) return text
    return null
  } catch {
    return null
  }
}

export default {
  encodeShared,
  decodeShared,
  getShareBase,
  fetchSharedById,
  uploadSharedPayload,
  shortenWithShlink,
  shortenUrlIfConfigured,
}
