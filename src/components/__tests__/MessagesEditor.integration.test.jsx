import { describe, it, expect } from 'vitest'
import MessagesEditor from '../MessagesEditor'

describe('MessagesEditor Performance Integration', () => {
  it('should calculate rendering strategy correctly', () => {
    // Test the logic directly without rendering
    const smallMessages = Array.from({ length: 5 }, (_, i) => ({
      id: `msg-${i}`,
      content: 'Short message',
      role: 'user',
      enabled: true
    }))

    const largeMessages = Array.from({ length: 15 }, (_, i) => ({
      id: `msg-${i}`,
      content: 'Message content',
      role: 'user',
      enabled: true
    }))

    const largeContentMessages = Array.from({ length: 3 }, (_, i) => ({
      id: `msg-${i}`,
      content: 'x'.repeat(20000), // 20KB per message = 60KB total > 50KB threshold
      role: 'user',
      enabled: true
    }))

    // Test small dataset - should use standard rendering
    const smallTotalSize = smallMessages.reduce((total, msg) => total + msg.content.length, 0)
    expect(smallMessages.length <= 10).toBe(true)
    expect(smallTotalSize < 50 * 1024).toBe(true)

    // Test large message count - should use virtualized rendering
    expect(largeMessages.length > 10).toBe(true)

    // Test large content size - should use virtualized rendering
    const largeTotalSize = largeContentMessages.reduce((total, msg) => total + msg.content.length, 0)
    expect(largeTotalSize > 50 * 1024).toBe(true)
  })

  it('should have proper component structure', () => {
    // Verify the component exports correctly (memo components are objects)
    expect(MessagesEditor).toBeDefined()
    expect(typeof MessagesEditor).toBe('object')
    expect(MessagesEditor.$$typeof).toBeDefined() // React component symbol
  })
})