import { useEffect, useMemo, useState, memo, useRef } from 'react'
import { Button } from 'antd'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import MessageItem from './MessageItem'

const MessagesEditor = memo(function MessagesEditor({
  selectedPrompt,
  selectedId,
  previewByMessageId,
  setPreviewByMessageId,
  collapsedByMessageId,
  setCollapsedByMessageId,
  updateMessage,
  removeMessage,
  addMessage,
  onDragEndMessages,
  MarkdownBlock,
}) {
  const [hoveredGutterIndex, setHoveredGutterIndex] = useState(null)
  const prevIdsRef = useRef([])
  const [newlyInsertedId, setNewlyInsertedId] = useState(null)
  const nodeByIdRef = useRef(new Map())
  const [exitingById, setExitingById] = useState({})

  // Detect newly inserted message by comparing ids
  useEffect(() => {
    const ids = selectedPrompt.messages.map(m => m.id)
    const prev = prevIdsRef.current
    let t
    if (prev.length && ids.length === prev.length + 1) {
      const added = ids.find(id => !prev.includes(id))
      if (added) {
        setNewlyInsertedId(added)
        t = setTimeout(() => setNewlyInsertedId(null), 600)
        // JS-driven enter height animation
        requestAnimationFrame(() => {
          const node = nodeByIdRef.current.get(added)
          if (!node) return
          try {
            const originalOverflow = node.style.overflow
            const originalHeight = node.style.height
            const originalOpacity = node.style.opacity
            node.style.overflow = 'hidden'
            const targetHeight = node.scrollHeight
            node.style.height = '0px'
            node.style.opacity = '0'
            // Force reflow
            // eslint-disable-next-line no-unused-expressions
            node.offsetHeight
            node.style.transition = 'height 280ms cubic-bezier(0.2, 0, 0, 1), opacity 220ms ease'
            node.style.height = targetHeight + 'px'
            node.style.opacity = '1'
            const clear = () => {
              node.style.transition = ''
              node.style.height = originalHeight
              node.style.overflow = originalOverflow
              node.style.opacity = originalOpacity
              node.removeEventListener('transitionend', clear)
            }
            node.addEventListener('transitionend', clear)
          } catch {}
        })
      }
    }
    prevIdsRef.current = ids
    return () => { if (t) clearTimeout(t) }
  }, [selectedPrompt.messages])

  // Calculate total content size for performance threshold
  const totalContentSize = useMemo(() => {
    return selectedPrompt.messages.reduce((total, message) => {
      return total + (message.content || '').length
    }, 0)
  }, [selectedPrompt.messages])

  // Memoized getItemSize calculation for virtualization
  const getItemSize = useMemo(() => {
    // Return memoized function
    return (index) => {
      const m = selectedPrompt.messages[index]
      if (!m) return 120
      
      if (collapsedByMessageId[m.id]) return 48
      
      if (previewByMessageId[m.id]) {
        const len = (m.content || '').length
        // Optimized calculation for preview mode
        const approx = 120 + Math.min(800, Math.ceil(len / 80) * 20)
        return approx
      }
      
      // Default expanded size - adjust based on content length for better estimation
      const contentLength = (m.content || '').length
      if (contentLength > 1000) {
        return Math.min(400, 200 + Math.ceil(contentLength / 100) * 10)
      }
      
      return 200
    }
  }, [selectedPrompt.messages, collapsedByMessageId, previewByMessageId])

  const listHeight = useMemo(() => {
    try { return Math.max(320, Math.min(720, Math.floor(window.innerHeight * 0.5))) } catch { return 480 }
  }, [])

  // Animated removal handler
  const handleRemoveWithAnimation = (id) => {
    try {
      setExitingById(prev => ({ ...prev, [id]: true }))
      const node = nodeByIdRef.current.get(id)
      if (!node) {
        setTimeout(() => removeMessage(id), 220)
        return
      }
      const originalOverflow = node.style.overflow
      const originalHeight = node.style.height
      const originalOpacity = node.style.opacity
      const height = node.offsetHeight
      node.style.overflow = 'hidden'
      node.style.height = height + 'px'
      node.style.opacity = '1'
      // Force reflow
      // eslint-disable-next-line no-unused-expressions
      node.offsetHeight
      node.style.transition = 'height 260ms cubic-bezier(0.2, 0, 0, 1), opacity 220ms ease'
      node.style.height = '0px'
      node.style.opacity = '0'
      let done = false
      const finish = () => {
        if (done) return
        done = true
        // Remove first to avoid visual flash from restoring styles
        removeMessage(id)
        // Clean up exit state
        setTimeout(() => {
          setExitingById(prev => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        }, 0)
        // Best-effort style cleanup (node may already be unmounted)
        try {
          node.style.transition = ''
          node.style.overflow = originalOverflow
        } catch {}
        node.removeEventListener('transitionend', finish)
      }
      node.addEventListener('transitionend', finish)
      setTimeout(finish, 340)
    } catch {
      removeMessage(id)
    }
  }

  // Render standard list with drag-and-drop
  const renderStandardList = () => (
    <DragDropContext onDragEnd={onDragEndMessages}>
      <Droppable droppableId={`messages-${selectedId || 'none'}`}>
        {(dropProvided) => (
          <div className="col" ref={dropProvided.innerRef} {...dropProvided.droppableProps} style={{ gap: 0 }}>
            {/* Top insertion gutter */}
            <div
              key={'gutter-0'}
              onMouseEnter={() => setHoveredGutterIndex(0)}
              onMouseLeave={() => setHoveredGutterIndex(prev => (prev === 0 ? null : prev))}
              style={{
                height: hoveredGutterIndex === 0 ? 44 : 12,
                transition: 'height 240ms cubic-bezier(0.2, 0, 0, 1)',
                transitionDelay: hoveredGutterIndex === 0 ? '150ms' : '0ms',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              <div style={{
                display: 'flex',
                gap: 8,
                opacity: hoveredGutterIndex === 0 ? 1 : 0,
                transform: hoveredGutterIndex === 0 ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.98)',
                transition: 'opacity 180ms ease, transform 220ms ease',
                transitionDelay: hoveredGutterIndex === 0 ? '150ms, 150ms' : '0ms, 0ms',
                pointerEvents: hoveredGutterIndex === 0 ? 'auto' : 'none'
              }}>
                <Button size="small" type="text" onClick={() => addMessage('system', 0)}>system</Button>
                <Button size="small" type="text" onClick={() => addMessage('user', 0)}>user</Button>
                <Button size="small" type="text" onClick={() => addMessage('assistant', 0)}>assistant</Button>
                <Button size="small" type="text" onClick={() => addMessage('comment', 0)}>comment</Button>
              </div>
            </div>
            {selectedPrompt.messages.map((m, index) => (
              <Draggable key={m.id} draggableId={m.id} index={index}>
                  {(dragProvided) => (
                    <div
                      key={m.id + '-draggableblock'}
                      ref={(node) => {
                        if (dragProvided.innerRef) {
                          if (typeof dragProvided.innerRef === 'function') {
                            dragProvided.innerRef(node)
                          } else if ('current' in dragProvided.innerRef) {
                            dragProvided.innerRef.current = node
                          }
                        }
                        if (node) {
                          nodeByIdRef.current.set(m.id, node)
                        }
                      }}
                      {...dragProvided.draggableProps}
                    >
                      <MessageItem
                        message={m}
                        isCollapsed={collapsedByMessageId[m.id]}
                        isPreview={previewByMessageId[m.id]}
                        onUpdate={updateMessage}
                        onToggleCollapse={setCollapsedByMessageId}
                        onTogglePreview={setPreviewByMessageId}
                        onRemove={handleRemoveWithAnimation}
                        MarkdownBlock={MarkdownBlock}
                        dragHandleProps={dragProvided.dragHandleProps}
                        isDragDisabled={false}
                        itemSpacing={0}
                        extraClassName={[
                          newlyInsertedId === m.id ? 'msg-enter' : '',
                          exitingById[m.id] ? 'msg-exit' : ''
                        ].filter(Boolean).join(' ')}
                      />
                      <div
                        key={'gutter-' + (index + 1)}
                        onMouseEnter={() => setHoveredGutterIndex(index + 1)}
                        onMouseLeave={() => setHoveredGutterIndex(prev => (prev === index + 1 ? null : prev))}
                        style={{
                          height: hoveredGutterIndex === index + 1 ? 44 : 12,
                          transition: 'height 240ms cubic-bezier(0.2, 0, 0, 1)',
                          transitionDelay: hoveredGutterIndex === index + 1 ? '150ms' : '0ms',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          gap: 8,
                          opacity: hoveredGutterIndex === index + 1 ? 1 : 0,
                          transform: hoveredGutterIndex === index + 1 ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.98)',
                          transition: 'opacity 180ms ease, transform 220ms ease',
                          transitionDelay: hoveredGutterIndex === index + 1 ? '150ms, 150ms' : '0ms, 0ms',
                          pointerEvents: hoveredGutterIndex === index + 1 ? 'auto' : 'none'
                        }}>
                          <Button style={{ color: 'var(--muted)' }} size="small" type="text" onClick={() => addMessage('system', index + 1)}>system</Button>
                          <Button style={{ color: 'var(--muted)' }} size="small" type="text" onClick={() => addMessage('user', index + 1)}>user</Button>
                          <Button style={{ color: 'var(--muted)' }} size="small" type="text" onClick={() => addMessage('assistant', index + 1)}>assistant</Button>
                          <Button style={{ color: 'var(--muted)' }} size="small" type="text" onClick={() => addMessage('comment', index + 1)}>comment</Button>
                        </div>
                      </div>
                    </div>
                  )}
              </Draggable>
            ))}
            {dropProvided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )

  return (
    <section>
      <div className="row" style={{ marginBottom: 8 }}>
        <strong>Messages</strong>
        {/* Performance indicator for development */}
        {process.env.NODE_ENV === 'development' && (
          <span style={{ 
            fontSize: '11px', 
            color: 'var(--muted)', 
            marginLeft: 8 
          }}>
            ({selectedPrompt.messages.length} msgs, {Math.round(totalContentSize / 1024)}KB)
          </span>
        )}
      </div>
      
      {renderStandardList()}
      
      <div className="row" style={{ marginTop: 8 }}>
        <Button size="small" onClick={() => addMessage('system')}>+ system</Button>
        <Button size="small" onClick={() => addMessage('user')}>+ user</Button>
        <Button size="small" onClick={() => addMessage('assistant')}>+ assistant</Button>
        <Button size="small" onClick={() => addMessage('comment')}>+ comment</Button>
      </div>
    </section>
  )
})

export default MessagesEditor