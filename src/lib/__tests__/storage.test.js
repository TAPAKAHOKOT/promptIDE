import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import LZString from 'lz-string'
import { getFromLocalStorage, setToLocalStorage, removeFromLocalStorage } from '../storage'

describe('storage helpers', () => {
  const store = new Map()

  beforeEach(() => {
    store.clear()
    const mock = {
      getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
      setItem: vi.fn((key, value) => { store.set(key, value) }),
      removeItem: vi.fn((key) => { store.delete(key) }),
    }
    vi.stubGlobal('localStorage', mock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns default when key missing', () => {
    expect(getFromLocalStorage('missing', 'fallback')).toBe('fallback')
  })

  it('reads compressed payloads', () => {
    const payload = { foo: 'bar', count: 2 }
    const compressed = LZString.compress(JSON.stringify(payload))
    const stored = JSON.stringify({ __compressed: true, data: compressed })
    globalThis.localStorage.setItem('compressed', stored)
    expect(getFromLocalStorage('compressed', null)).toEqual(payload)
  })

  it('writes objects as JSON strings', () => {
    setToLocalStorage('obj', { a: 1 })
    expect(store.get('obj')).toBe(JSON.stringify({ a: 1 }))
  })

  it('removes keys safely', () => {
    globalThis.localStorage.setItem('tmp', 'value')
    removeFromLocalStorage('tmp')
    expect(store.has('tmp')).toBe(false)
  })
})
