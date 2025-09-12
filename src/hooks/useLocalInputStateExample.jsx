import React from 'react'
import { Input } from 'antd'
import useLocalInputState from './useLocalInputState'

/**
 * Example of how useLocalInputState would be integrated into MessageItem component
 * This shows the pattern for the next task (Task 3)
 */
function MessageItemWithLocalState({ message, onUpdate }) {
  // Use the hook for content editing with optimized performance
  const {
    localValue,
    setLocalValue,
    syncNow,
    isDirty,
    handleBlur
  } = useLocalInputState({
    initialValue: message.content || '',
    onSync: (value) => {
      // This will be called after debounce delay or manual sync
      onUpdate(message.id, { content: value })
    },
    debounceMs: 300, // 300ms for typing
    syncOnBlur: true  // Sync immediately on blur
  })

  // Handle input changes - updates local state immediately
  const handleContentChange = (e) => {
    setLocalValue(e.target.value)
  }

  // For scenarios like "Run" button or prompt switching, call syncNow()
  const handleRunOrSwitch = () => {
    if (isDirty) {
      syncNow() // Commit any unsaved changes immediately
    }
    // ... rest of run/switch logic
  }

  return (
    <div>
      <Input.TextArea
        value={localValue}
        onChange={handleContentChange}
        onBlur={handleBlur}
        placeholder="Message content"
        autoSize={{ minRows: 6, maxRows: 20 }}
        style={{
          // Visual indicator for unsaved changes
          borderColor: isDirty ? '#faad14' : undefined
        }}
      />
      {isDirty && (
        <div style={{ color: '#faad14', fontSize: '12px', marginTop: 4 }}>
          Unsaved changes
        </div>
      )}
    </div>
  )
}

export default MessageItemWithLocalState