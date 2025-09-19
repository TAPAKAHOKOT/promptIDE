import { useCallback, useEffect, useRef } from 'react'
import LZString from 'lz-string'

/**
 * Persist a value to localStorage using a debounced writer with optional
 * compression for large payloads. Designed for heavy editors where writes must
 * not block the UI thread.
 */
export function useDebouncedLocalStorage(key, value, delay = 1000, enabled = true, options = {}) {
  const {
    compressionThreshold = 50000,
    maxDelay = 5000,
    backgroundSync = true,
    autoFlush = true,
  } = options

  const timerRef = useRef(null)
  const flushRef = useRef(null)
  const isUnmountingRef = useRef(false)

  const calculateDelay = useCallback((content) => {
    if (!content) return delay

    const size = typeof content === 'string' ? content.length : JSON.stringify(content).length

    if (size > 100000) return Math.min(maxDelay, delay * 3)
    if (size > 50000) return Math.min(maxDelay, delay * 2)
    if (size > 10000) return Math.min(maxDelay, delay * 1.5)

    return delay
  }, [delay, maxDelay])

  const serializeInBackground = useCallback((data) => new Promise((resolve) => {
    if (!backgroundSync) {
      try {
        resolve(typeof data === 'string' ? data : JSON.stringify(data))
      } catch (error) {
        console.warn('Serialization failed:', error)
        resolve(null)
      }
      return
    }

    setTimeout(() => {
      try {
        resolve(typeof data === 'string' ? data : JSON.stringify(data))
      } catch (error) {
        console.warn('Serialization failed:', error)
        resolve(null)
      }
    }, 0)
  }), [backgroundSync])

  const compressIfNeeded = useCallback((str) => {
    if (!str || str.length < compressionThreshold) {
      return { data: str, compressed: false }
    }

    try {
      const compressed = LZString.compress(str)
      if (compressed && compressed.length < str.length * 0.8) {
        return { data: compressed, compressed: true }
      }
    } catch (error) {
      console.warn('Compression failed:', error)
    }

    return { data: str, compressed: false }
  }, [compressionThreshold])

  const flush = useCallback(async () => {
    if (!enabled || !key || isUnmountingRef.current) return

    try {
      const serialized = await serializeInBackground(value)
      if (!serialized) return

      const { data, compressed } = compressIfNeeded(serialized)
      const storageData = compressed
        ? JSON.stringify({ __compressed: true, data })
        : data

      localStorage.setItem(key, storageData)

      if (compressed) {
        console.debug(`Saved ${key} with compression: ${serialized.length} -> ${data.length} bytes`)
      }
    } catch (error) {
      console.warn('Failed to flush to localStorage:', error)
    }
  }, [enabled, key, value, serializeInBackground, compressIfNeeded])

  flushRef.current = flush

  useEffect(() => {
    if (!enabled || !key) return undefined

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    const snapshot = value
    const dynamicDelay = calculateDelay(snapshot)

    timerRef.current = setTimeout(async () => {
      if (isUnmountingRef.current) return

      try {
        const serialized = await serializeInBackground(snapshot)
        if (!serialized || isUnmountingRef.current) return

        const { data, compressed } = compressIfNeeded(serialized)
        const storageData = compressed
          ? JSON.stringify({ __compressed: true, data })
          : data

        localStorage.setItem(key, storageData)

        if (compressed) {
          console.debug(`Auto-saved ${key} with compression: ${serialized.length} -> ${data.length} bytes`)
        }
      } catch (error) {
        console.warn('Auto-save failed:', error)
      }
    }, dynamicDelay)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [key, value, enabled, calculateDelay, serializeInBackground, compressIfNeeded])

  useEffect(() => {
    if (!autoFlush) return undefined

    const handleBeforeUnload = () => {
      isUnmountingRef.current = true
      if (!key || !enabled) return

      try {
        const str = typeof value === 'string' ? value : JSON.stringify(value)
        const { data, compressed } = compressIfNeeded(str)
        const storageData = compressed
          ? JSON.stringify({ __compressed: true, data })
          : data
        localStorage.setItem(key, storageData)
      } catch (error) {
        console.warn('Emergency flush failed:', error)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && flushRef.current) {
        flushRef.current()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isUnmountingRef.current = true
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (flushRef.current && enabled && key) {
        flushRef.current()
      }
    }
  }, [autoFlush, key, enabled, value, compressIfNeeded])

  return { flush }
}

export default useDebouncedLocalStorage
