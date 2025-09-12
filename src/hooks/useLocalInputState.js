import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Custom hook for managing local input state with debounced global synchronization
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.initialValue - Initial value for the local state
 * @param {Function} options.onSync - Callback function to sync local state to global state
 * @param {number} [options.debounceMs=300] - Debounce delay in milliseconds (default 300ms for typing)
 * @param {boolean} [options.syncOnBlur=true] - Whether to sync immediately on blur event
 * @returns {Object} Hook return object
 * @returns {string} returns.localValue - Current local value
 * @returns {Function} returns.setLocalValue - Function to update local value
 * @returns {Function} returns.syncNow - Function to manually trigger immediate synchronization
 * @returns {boolean} returns.isDirty - Flag indicating if local value differs from initial/synced value
 */
function useLocalInputState({
  initialValue,
  onSync,
  debounceMs = 300,
  syncOnBlur = true
}) {
  // Local state for the input value
  const [localValue, setLocalValue] = useState(initialValue || '')
  
  // Track the last synced value to determine if state is dirty
  const [lastSyncedValue, setLastSyncedValue] = useState(initialValue || '')
  
  // Ref to store the current timer for cleanup
  const timerRef = useRef(null)
  
  // Ref to store the latest onSync callback to avoid stale closures
  const onSyncRef = useRef(onSync)
  onSyncRef.current = onSync

  // Calculate if the current state is dirty (has unsaved changes)
  const isDirty = localValue !== lastSyncedValue

  // Function to perform the actual synchronization
  const performSync = useCallback(() => {
    if (localValue !== lastSyncedValue && onSyncRef.current) {
      onSyncRef.current(localValue)
      setLastSyncedValue(localValue)
    }
  }, [localValue, lastSyncedValue])

  // Manual synchronization function
  const syncNow = useCallback(() => {
    // Clear any pending debounced sync
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    performSync()
  }, [performSync])

  // Enhanced setLocalValue that handles debounced synchronization
  const setLocalValueWithSync = useCallback((newValue) => {
    // Update local state immediately for responsive UI
    setLocalValue(newValue)
    
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    
    // Set up new debounced sync timer
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (onSyncRef.current) {
        onSyncRef.current(newValue)
        setLastSyncedValue(newValue)
      }
    }, debounceMs)
  }, [debounceMs])

  // Update local state when initialValue changes externally (e.g., switching between messages)
  useEffect(() => {
    if (initialValue !== lastSyncedValue && !isDirty) {
      setLocalValue(initialValue || '')
      setLastSyncedValue(initialValue || '')
    }
  }, [initialValue, lastSyncedValue, isDirty])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  // Create blur handler if syncOnBlur is enabled
  const handleBlur = useCallback(() => {
    if (syncOnBlur && isDirty) {
      syncNow()
    }
  }, [syncOnBlur, isDirty, syncNow])

  return {
    localValue,
    setLocalValue: setLocalValueWithSync,
    syncNow,
    isDirty,
    handleBlur: syncOnBlur ? handleBlur : undefined
  }
}

export default useLocalInputState