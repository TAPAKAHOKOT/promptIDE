import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import useLocalInputState from '../useLocalInputState'

// Mock timers for testing debounce behavior
vi.useFakeTimers()

describe('useLocalInputState', () => {
  let mockOnSync

  beforeEach(() => {
    mockOnSync = vi.fn()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.clearAllMocks()
  })

  it('should initialize with the provided initial value', () => {
    const { result } = renderHook(() =>
      useLocalInputState({
        initialValue: 'test value',
        onSync: mockOnSync
      })
    )

    expect(result.current.localValue).toBe('test value')
    expect(result.current.isDirty).toBe(false)
  })

  it('should update local value immediately and mark as dirty', () => {
    const { result } = renderHook(() =>
      useLocalInputState({
        initialValue: 'initial',
        onSync: mockOnSync
      })
    )

    act(() => {
      result.current.setLocalValue('updated')
    })

    expect(result.current.localValue).toBe('updated')
    expect(result.current.isDirty).toBe(true)
    expect(mockOnSync).not.toHaveBeenCalled()
  })

  it('should sync after debounce delay', () => {
    const { result } = renderHook(() =>
      useLocalInputState({
        initialValue: 'initial',
        onSync: mockOnSync,
        debounceMs: 300
      })
    )

    act(() => {
      result.current.setLocalValue('updated')
    })

    expect(mockOnSync).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(mockOnSync).toHaveBeenCalledWith('updated')
    expect(result.current.isDirty).toBe(false)
  })

  it('should cancel previous timer when value changes rapidly', () => {
    const { result } = renderHook(() =>
      useLocalInputState({
        initialValue: 'initial',
        onSync: mockOnSync,
        debounceMs: 300
      })
    )

    act(() => {
      result.current.setLocalValue('first')
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    act(() => {
      result.current.setLocalValue('second')
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(mockOnSync).toHaveBeenCalledTimes(1)
    expect(mockOnSync).toHaveBeenCalledWith('second')
  })

  it('should sync immediately when syncNow is called', () => {
    const { result } = renderHook(() =>
      useLocalInputState({
        initialValue: 'initial',
        onSync: mockOnSync,
        debounceMs: 300
      })
    )

    act(() => {
      result.current.setLocalValue('updated')
    })

    act(() => {
      result.current.syncNow()
    })

    expect(mockOnSync).toHaveBeenCalledWith('updated')
    expect(result.current.isDirty).toBe(false)

    // Should not sync again after debounce delay
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(mockOnSync).toHaveBeenCalledTimes(1)
  })

  it('should handle blur synchronization when enabled', () => {
    const { result } = renderHook(() =>
      useLocalInputState({
        initialValue: 'initial',
        onSync: mockOnSync,
        syncOnBlur: true
      })
    )

    act(() => {
      result.current.setLocalValue('updated')
    })

    expect(result.current.handleBlur).toBeDefined()

    act(() => {
      result.current.handleBlur()
    })

    expect(mockOnSync).toHaveBeenCalledWith('updated')
    expect(result.current.isDirty).toBe(false)
  })

  it('should not provide handleBlur when syncOnBlur is disabled', () => {
    const { result } = renderHook(() =>
      useLocalInputState({
        initialValue: 'initial',
        onSync: mockOnSync,
        syncOnBlur: false
      })
    )

    expect(result.current.handleBlur).toBeUndefined()
  })

  it('should update local value when initialValue changes externally', () => {
    let initialValue = 'first'
    const { result, rerender } = renderHook(() =>
      useLocalInputState({
        initialValue,
        onSync: mockOnSync
      })
    )

    expect(result.current.localValue).toBe('first')

    // Change initial value and rerender
    initialValue = 'second'
    rerender()

    expect(result.current.localValue).toBe('second')
    expect(result.current.isDirty).toBe(false)
  })

  it('should not update local value when initialValue changes if state is dirty', () => {
    let initialValue = 'first'
    const { result, rerender } = renderHook(() =>
      useLocalInputState({
        initialValue,
        onSync: mockOnSync
      })
    )

    // Make local changes
    act(() => {
      result.current.setLocalValue('modified')
    })

    expect(result.current.isDirty).toBe(true)

    // Change initial value and rerender
    initialValue = 'second'
    rerender()

    // Should keep the modified local value
    expect(result.current.localValue).toBe('modified')
    expect(result.current.isDirty).toBe(true)
  })

  it('should use custom debounce delay', () => {
    const { result } = renderHook(() =>
      useLocalInputState({
        initialValue: 'initial',
        onSync: mockOnSync,
        debounceMs: 1000
      })
    )

    act(() => {
      result.current.setLocalValue('updated')
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(mockOnSync).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(mockOnSync).toHaveBeenCalledWith('updated')
  })
})