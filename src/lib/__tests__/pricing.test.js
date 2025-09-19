import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getPricingTable, estimateCostUSD, HARDCODED_PRICING } from '../pricing'

describe('pricing helpers', () => {
  beforeEach(() => {
    const store = new Map()
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

  it('computes usage cost with explicit table', () => {
    const table = {
      'gpt-4o': { prompt: 0.0025, completion: 0.01 },
    }
    const usage = { prompt_tokens: 1000, completion_tokens: 500 }
    expect(estimateCostUSD('gpt-4o', usage, table)).toBeCloseTo(0.0025 + 0.005)
  })

  it('falls back to hardcoded pricing when table missing', () => {
    const usage = { prompt_tokens: 1000, completion_tokens: 0 }
    const expected = (HARDCODED_PRICING['gpt-4o'].prompt / 1000) * 1000
    expect(estimateCostUSD('gpt-4o', usage)).toBeCloseTo(expected)
  })

  it('prefers env table when provided', () => {
    const envTable = { custom: { prompt: 0.01, completion: 0.02 } }
    const resolved = getPricingTable({ envTable })
    expect(resolved).toBe(envTable)
  })
})
