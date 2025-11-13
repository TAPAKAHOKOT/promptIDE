import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
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

  const assistantToolCallsCount = useMemo(() => {
    if (message.role !== 'assistant') return 0
    if (Array.isArray(message.toolCalls) && message.toolCalls.length) return message.toolCalls.length
    if (Array.isArray(message.tool_calls) && message.tool_calls.length) return message.tool_calls.length
    return 0
  }, [message.role, message.toolCalls, message.tool_calls])

  const hasAssistantToolCalls = assistantToolCallsCount > 0

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
          onChange={val => {
            const patch = { role: val }
            if (val === 'assistant') {
              const fromApi = Array.isArray(message.tool_calls)
                ? message.tool_calls.map((tc, idx) => ({
                    id: tc?.id || tc?.tool_call_id || `tool_call_${idx}`,
                    name: tc?.function?.name || tc?.name || '',
                    arguments: typeof tc?.function?.arguments === 'string'
                      ? tc.function.arguments
                      : (() => {
                          try {
                            return tc?.function?.arguments != null ? JSON.stringify(tc.function.arguments) : ''
                          } catch {
                            return ''
                          }
                        })(),
                    type: tc?.type || 'function'
                  }))
                : []
              patch.toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : fromApi
            }
            if (val === 'tool') {
              patch.toolCallId = message.toolCallId || message.tool_call_id || ''
              patch.toolName = message.toolName || message.name || ''
            }
            onUpdate(message.id, patch)
          }}
          style={{ width: 140 }}
          options={[
            { value: 'system', label: 'system' },
            { value: 'user', label: 'user' },
            { value: 'assistant', label: 'assistant' },
            { value: 'tool', label: 'tool' },
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
          <>
            {message.role === 'assistant' && (
              <AssistantToolCallsEditor
                message={message}
                onUpdate={onUpdate}
              />
            )}
            {message.role === 'tool' && (
              <ToolResponseEditor
                message={message}
                onUpdate={onUpdate}
              />
            )}
            {isPreview ? (
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
              hasAssistantToolCalls ? (
                <div className="panel" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel)' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: message.content ? 8 : 0 }}>
                    Message content controlled by tool calls. Edit tool responses instead.
                  </div>
                  {message.content && (
                    <Typography.Paragraph style={{ 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-word', 
                      overflowWrap: 'anywhere', 
                      marginBottom: 0 
                    }}>
                      <MarkdownBlock content={message.content} />
                    </Typography.Paragraph>
                  )}
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
          </>
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
    prevProps.message.toolCalls === nextProps.message.toolCalls &&
    prevProps.message.tool_call_id === nextProps.message.tool_call_id &&
    prevProps.message.toolCallId === nextProps.message.toolCallId &&
    prevProps.message.toolName === nextProps.message.toolName &&
    prevProps.isCollapsed === nextProps.isCollapsed &&
    prevProps.isPreview === nextProps.isPreview &&
    prevProps.isDragDisabled === nextProps.isDragDisabled
  )
})

export default MessageItem

function normalizeToolCall(tc, fallbackId) {
  if (!tc) {
    return {
      id: fallbackId || '',
      name: '',
      arguments: '',
      type: 'function',
    }
  }
  const id = tc.id || tc.tool_call_id || fallbackId || ''
  const type = tc.type || 'function'
  let name = ''
  let args = ''
  if (tc.function && typeof tc.function === 'object') {
    name = tc.function.name || ''
    args = tc.function.arguments
  } else {
    name = tc.name || ''
    args = tc.arguments
  }
  if (args && typeof args !== 'string') {
    try {
      args = JSON.stringify(args)
    } catch {
      args = String(args)
    }
  }
  return {
    id: id || '',
    name: name || '',
    arguments: args || '',
    type,
  }
}

function AssistantToolCallsEditor({ message, onUpdate }) {
  const toolCalls = useMemo(() => {
    if (Array.isArray(message.toolCalls)) {
      return message.toolCalls.map((tc, idx) => normalizeToolCall(tc, `tool_call_${idx}`))
    }
    if (Array.isArray(message.tool_calls)) {
      return message.tool_calls.map((tc, idx) => normalizeToolCall(tc, `tool_call_${idx}`))
    }
    return []
  }, [message.toolCalls, message.tool_calls])

  useEffect(() => {
    if (message.role !== 'assistant') return
    if (Array.isArray(message.toolCalls)) return
    if (!toolCalls.length) return
    onUpdate(message.id, { toolCalls, tool_calls: undefined })
  }, [message.id, message.role, message.toolCalls, toolCalls, onUpdate])

  const updateToolCalls = useCallback((next) => {
    onUpdate(message.id, { toolCalls: next, tool_calls: undefined })
  }, [message.id, onUpdate])

  const handleAdd = useCallback(() => {
    const next = [
      ...toolCalls,
      { id: `tool_call_${toolCalls.length + 1}`, name: '', arguments: '', type: 'function' }
    ]
    updateToolCalls(next)
  }, [toolCalls, updateToolCalls])

  const handleChange = useCallback((index, patch) => {
    updateToolCalls(toolCalls.map((tc, idx) => (idx === index ? { ...tc, ...patch } : tc)))
  }, [toolCalls, updateToolCalls])

  const handleRemove = useCallback((index) => {
    updateToolCalls(toolCalls.filter((_, idx) => idx !== index))
  }, [toolCalls, updateToolCalls])

  if (toolCalls.length === 0) {
    return (
      <div className="panel" style={{ borderColor: 'var(--panel-border)', marginBottom: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <strong>Tool calls</strong>
          <Button size="small" onClick={handleAdd}>+ tool call</Button>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>No tool calls configured yet.</div>
      </div>
    )
  }

  return (
    <div className="panel" style={{ borderColor: 'var(--panel-border)', marginBottom: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <strong>Tool calls</strong>
        <Button size="small" onClick={handleAdd}>+ tool call</Button>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {toolCalls.map((tc, idx) => (
          <div key={idx} className="panel" style={{ borderColor: 'var(--panel-border)' }}>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <Input
                size="small"
                value={tc.id}
                onChange={e => handleChange(idx, { id: e.target.value })}
                placeholder="tool_call_id (auto if blank)"
              />
              <Input
                size="small"
                value={tc.name}
                onChange={e => handleChange(idx, { name: e.target.value })}
                placeholder="function name"
              />
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemove(idx)}
              />
            </div>
            <Input.TextArea
              value={tc.arguments}
              onChange={e => handleChange(idx, { arguments: e.target.value })}
              placeholder="arguments (JSON string)"
              autoSize={{ minRows: 3, maxRows: 8 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function ToolResponseEditor({ message, onUpdate }) {
  const handleChange = useCallback((patch) => {
    const nextPatch = { ...patch }
    if (Object.prototype.hasOwnProperty.call(patch, 'toolCallId')) {
      nextPatch.tool_call_id = undefined
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'toolName')) {
      nextPatch.name = undefined
    }
    onUpdate(message.id, nextPatch)
  }, [message.id, onUpdate])

  return (
    <div className="panel" style={{ borderColor: 'var(--panel-border)', marginBottom: 8 }}>
      <div className="col" style={{ gap: 6 }}>
        <Input
          size="small"
          value={message.toolCallId ?? message.tool_call_id ?? ''}
          onChange={e => handleChange({ toolCallId: e.target.value })}
          placeholder="tool_call_id to respond to"
        />
        <Input
          size="small"
          value={message.toolName ?? message.name ?? ''}
          onChange={e => handleChange({ toolName: e.target.value })}
          placeholder="tool name (optional)"
        />
      </div>
    </div>
  )
}