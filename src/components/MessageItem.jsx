import { useCallback, useEffect, useRef, useState, memo } from 'react'
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
  isDragDisabled = false,
  // Spacing applied as margin-bottom on the draggable root for DnD correctness
  itemSpacing = 0,
  // Optional extra class applied on root for transient animations
  extraClassName = '',
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

  // Smooth expand/collapse animation for content area
  const contentRef = useRef(null)
  const [shouldRenderContent, setShouldRenderContent] = useState(!isCollapsed)

  // Handle collapsing animation (children already mounted)
  useEffect(() => {
    if (!isCollapsed) return
    const node = contentRef.current
    if (!node) return
    let cleaned = false
    const onEnd = () => {
      if (cleaned) return
      cleaned = true
      try {
        node.style.transition = ''
        node.style.overflow = ''
        node.style.display = 'none'
        node.style.height = '0px'
        node.style.opacity = '0'
        setShouldRenderContent(false)
      } catch { /* fill */ }
      node.removeEventListener('transitionend', onEnd)
    }
    requestAnimationFrame(() => {
      try {
        node.style.display = ''
        node.style.overflow = 'hidden'
        const start = node.scrollHeight
        node.style.height = start + 'px'
        node.style.opacity = '1'
        // Force reflow
        // eslint-disable-next-line no-unused-expressions
        node.offsetHeight
        node.style.transition = 'height 240ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease'
        node.style.height = '0px'
        node.style.opacity = '0'
        node.addEventListener('transitionend', onEnd)
        setTimeout(onEnd, 340)
      } catch { /* fill */ }
    })
    return () => { if (!cleaned) onEnd() }
  }, [isCollapsed])

  // Ensure content is mounted before expanding; then animate open
  useEffect(() => {
    if (isCollapsed) return
    if (!shouldRenderContent) {
      setShouldRenderContent(true)
      return
    }
    const node = contentRef.current
    if (!node) return
    let cleaned = false
    const onEnd = () => {
      if (cleaned) return
      cleaned = true
      try {
        node.style.transition = ''
        node.style.overflow = ''
        node.style.height = ''
        node.style.opacity = ''
      } catch { /* fill */ }
      node.removeEventListener('transitionend', onEnd)
    }
    requestAnimationFrame(() => {
      try {
        node.style.display = ''
        node.style.overflow = 'hidden'
        node.style.height = '0px'
        node.style.opacity = '0'
        // Force reflow
        // eslint-disable-next-line no-unused-expressions
        node.offsetHeight
        const target = node.scrollHeight
        node.style.transition = 'height 260ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease'
        node.style.height = target + 'px'
        node.style.opacity = '1'
        node.addEventListener('transitionend', onEnd)
        setTimeout(onEnd, 360)
      } catch { /* fill */ }
    })
    return () => { if (!cleaned) onEnd() }
  }, [isCollapsed, shouldRenderContent])

  return (
    <div
      className={`panel${extraClassName ? ' ' + extraClassName : ''}`}
      style={{ 
        opacity: message.enabled !== false ? 1 : 0.5,
        marginBottom: itemSpacing
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
      <div ref={contentRef} style={{ display: isCollapsed && !shouldRenderContent ? 'none' : undefined }}>
        {shouldRenderContent && (
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
    prevProps.isDragDisabled === nextProps.isDragDisabled
  )
})

export default MessageItem