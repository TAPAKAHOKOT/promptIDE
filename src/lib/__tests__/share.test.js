import { describe, it, expect } from 'vitest'
import { encodeShared, decodeShared } from '../share'

describe('share helpers', () => {
  it('encodes and decodes payloads round-trip', () => {
    const payload = {
      kind: 'prompt',
      title: 'Example',
      messages: [
        { role: 'system', content: 'You are a tutor' },
        { role: 'user', content: 'Explain recursion' },
      ],
    }

    const encoded = encodeShared(payload)
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(0)
    expect(decodeShared(encoded)).toEqual(payload)
  })

  it('returns null for malformed input', () => {
    expect(decodeShared('not-a-real-share')).toBeNull()
  })
})
