import { useCallback, memo } from 'react'
import { Button, Input, Select, Switch, Popconfirm, Typography } from 'antd'
import { HolderOutlined, DownOutlined, RightOutlined, DeleteOutlined } from '@ant-design/icons'
import useLocalInputState from '../hooks/useLocalInputState'

// Props interface for MessageItem component
const MessageItem = memo(function MessageItem({
  message,
  isCollapsed,
  isPreview,
  onUpdate,
  onToggleCollapse,
  onTogglePreview,
  onRemove,
  MarkdownBlock,
  dragHandleProps,
  draggableProps,
  innerRef,
  isDragDisabled = false,
  // Spacing applied as margin-bottom on the draggable root for DnD correctness
  itemSpacing = 0,
}) {
  // Local state management for message content using useLocalInputState hook
  const {
    localValue: localContent,
    setLocalValue: setLocalContent,
    syncNow,
    isDirty,
    handleBlur
  } = useLocalInputState({
    initialValue: message.content || '',
    onSync: useCallback((newContent) => {
      onUpdate(message.id, { content: newContent })
    }, [onUpdate, message.id]),
    debounceMs: 500, // 500ms delay for auto-save as per requirements
    syncOnBlur: true
  })

  // Handle content changes with local state
  const handleContentChange = useCallback((e) => {
    setLocalContent(e.target.value)
  }, [setLocalContent])

  // Handle toggle collapse
  const handleToggleCollapse = useCallback(() => {
    onToggleCollapse(prev => ({ ...prev, [message.id]: !prev[message.id] }))
  }, [onToggleCollapse, message.id])

  // Handle toggle preview
  const handleTogglePreview = useCallback(() => {
    onTogglePreview(prev => ({ ...prev, [message.id]: !prev[message.id] }))
  }, [onTogglePreview, message.id])

  // Manual sync function for immediate commits (e.g., when switching prompts)
  // This could be exposed to parent components if needed in the future
  // const handleManualSync = useCallback(() => {
  //   if (isDirty) {
  //     syncNow()
  //   }
  // }, [isDirty, syncNow])

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      className="panel"
      style={{ 
        opacity: message.enabled !== false ? 1 : 0.5,
        marginBottom: itemSpacing,
        ...draggableProps?.style
      }}
    >
      <div className="row" style={{ marginBottom: 6 }}>
        {!isDragDisabled && (
          <span
            {...dragHandleProps}
            title="Drag to reorder"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              cursor: 'grab', 
              color: 'var(--muted)' 
            }}
          >
            <HolderOutlined />
          </span>
        )}
        {isDragDisabled && (
          <span
            title="Reorder"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              color: 'var(--muted)' 
            }}
          >
            <HolderOutlined />
          </span>
        )}
        <Button 
          type="text" 
          size="small" 
          onClick={handleToggleCollapse}
        >
          {isCollapsed ? <RightOutlined /> : <DownOutlined />}
        </Button>
        <Select
          size="small"
          value={message.role}
          onChange={val => onUpdate(message.id, { role: val })}
          style={{ width: 140 }}
          options={[
            { value: 'system', label: 'system' },
            { value: 'user', label: 'user' },
            { value: 'assistant', label: 'assistant' },
            { value: 'comment', label: 'comment' },
          ]}
        />
        <Input
          size="small"
          value={message.label || ''}
          onChange={e => onUpdate(message.id, { label: e.target.value })}
          placeholder="label"
          style={{ width: 160 }}
        />
        <Button 
          size="small" 
          onClick={handleTogglePreview}
        >
          {isPreview ? 'Edit' : 'Preview'}
        </Button>
        <Switch
          size="small"
          checked={message.enabled !== false}
          onChange={val => onUpdate(message.id, { enabled: val })}
        />
        <Popconfirm
          title="Delete message?"
          okText="Delete"
          cancelText="Cancel"
          onConfirm={() => onRemove(message.id)}
        >
          <Button size="small" type="text" danger icon={<DeleteOutlined />} title="Delete" />
        </Popconfirm>
      </div>
      {!isCollapsed && (
        isPreview ? (
          <div className="panel" style={{ borderColor: 'var(--panel-border)' }}>
            <Typography.Paragraph style={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word', 
              overflowWrap: 'anywhere', 
              lineHeight: 0.8 
            }}>
              <MarkdownBlock content={message.content} />
            </Typography.Paragraph>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <Input.TextArea
              value={localContent}
              onChange={handleContentChange}
              onBlur={handleBlur}
              autoSize={{ minRows: 6, maxRows: 20 }}
              placeholder="Message content (Markdown supported)"
              style={isDirty ? { 
                borderColor: '#faad14',
                boxShadow: '0 0 0 2px rgba(250, 173, 20, 0.2)'
              } : {}}
            />
            {isDirty && (
              <div
                style={{
                  position: 'absolute',
                  top: -8,
                  right: 8,
                  backgroundColor: '#faad14',
                  color: 'white',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  fontWeight: 'bold',
                  zIndex: 1
                }}
                title="Unsaved changes - will auto-save in a moment or save on blur"
              >
                UNSAVED
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.role === nextProps.message.role &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.label === nextProps.message.label &&
    prevProps.message.enabled === nextProps.message.enabled &&
    prevProps.isCollapsed === nextProps.isCollapsed &&
    prevProps.isPreview === nextProps.isPreview &&
    prevProps.isDragDisabled === nextProps.isDragDisabled &&
    // Ensure re-render during drag to apply transform/transition styles from DnD
    prevProps.draggableProps?.style === nextProps.draggableProps?.style
  )
})

export default MessageItem