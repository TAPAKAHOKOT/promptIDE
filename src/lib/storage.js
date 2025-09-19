import LZString from 'lz-string'

export function getFromLocalStorage(key, defaultValue = null) {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return defaultValue

    try {
      const parsed = JSON.parse(stored)
      if (parsed && typeof parsed === 'object' && parsed.__compressed === true) {
        const decompressed = LZString.decompress(parsed.data)
        return decompressed ? JSON.parse(decompressed) : defaultValue
      }
      if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'data')) {
        return parsed
      }
      return parsed
    } catch {
      return stored
    }
  } catch (error) {
    console.warn(`Failed to read from localStorage key "${key}":`, error)
    return defaultValue
  }
}

export function setToLocalStorage(key, value) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(key, serialized)
    return true
  } catch (error) {
    console.warn(`Failed to write to localStorage key "${key}":`, error)
    return false
  }
}

export function removeFromLocalStorage(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.warn(`Failed to remove localStorage key "${key}":`, error)
    return false
  }
}

export default {
  getFromLocalStorage,
  setToLocalStorage,
  removeFromLocalStorage,
}
