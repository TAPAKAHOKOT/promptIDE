# useLocalInputState Hook

A custom React hook for managing local input state with debounced global synchronization, designed to optimize typing performance in the Prompt IDE application.

## Features

- **Immediate UI Response**: Local state updates instantly for smooth typing experience
- **Configurable Debounce**: Customizable delay for global state synchronization (default 300ms)
- **Blur Synchronization**: Optional immediate sync when input loses focus
- **Dirty State Tracking**: Tracks unsaved changes with `isDirty` flag
- **Manual Synchronization**: `syncNow()` function for immediate commits
- **External Updates**: Handles external value changes when not dirty

## Usage

```javascript
import useLocalInputState from './hooks/useLocalInputState'

function MyComponent({ initialValue, onUpdate }) {
  const {
    localValue,
    setLocalValue,
    syncNow,
    isDirty,
    handleBlur
  } = useLocalInputState({
    initialValue: initialValue,
    onSync: onUpdate,
    debounceMs: 300,      // Optional: debounce delay (default 300ms)
    syncOnBlur: true      // Optional: sync on blur (default true)
  })

  return (
    <input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      style={{ borderColor: isDirty ? '#faad14' : undefined }}
    />
  )
}
```

## API

### Parameters

- `initialValue` (string): Initial value for the local state
- `onSync` (function): Callback function to sync local state to global state
- `debounceMs` (number, optional): Debounce delay in milliseconds (default: 300)
- `syncOnBlur` (boolean, optional): Whether to sync immediately on blur (default: true)

### Returns

- `localValue` (string): Current local value
- `setLocalValue` (function): Function to update local value
- `syncNow` (function): Function to manually trigger immediate synchronization
- `isDirty` (boolean): Flag indicating if local value differs from synced value
- `handleBlur` (function): Blur event handler (only when syncOnBlur is true)

## Performance Benefits

1. **Eliminates Re-render Lag**: Only the local component re-renders during typing
2. **Reduces Global State Updates**: Batches updates using debounce
3. **Maintains Responsiveness**: UI updates immediately while deferring expensive operations
4. **Prevents Data Loss**: Ensures changes are committed on blur or manual sync

## Use Cases

- **Typing Optimization**: 300ms debounce for responsive text input
- **Auto-save Scenarios**: 1000ms+ debounce for background persistence
- **Form Validation**: Immediate local feedback with deferred validation
- **Large Text Areas**: Smooth editing of long content (1500+ words)

## Requirements Satisfied

This hook satisfies the following performance requirements:

- **2.1**: Input responds immediately without noticeable delay
- **2.2**: Global state updates deferred until typing pauses or blur
- **2.3**: Local changes synchronized after defined period
- **2.4**: Manual sync available for immediate commits (Run/switch scenarios)