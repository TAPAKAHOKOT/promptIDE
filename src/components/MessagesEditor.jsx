import { useEffect, useMemo, useState, memo } from 'react'
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
  // Performance configuration props
  performanceMode = 'standard',
}) {
  const [VList, setVList] = useState(null)
  
  // Load react-window for virtualization
  useEffect(() => {
    let mounted = true
    import('react-window')
      .then((mod) => {
        if (!mounted) return
        const Comp = mod.VariableSizeList || mod.default?.VariableSizeList || mod.FixedSizeList || mod.default?.FixedSizeList
        if (Comp) setVList(() => Comp)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  // Calculate total content size for performance threshold
  const totalContentSize = useMemo(() => {
    return selectedPrompt.messages.reduce((total, message) => {
      return total + (message.content || '').length
    }, 0)
  }, [selectedPrompt.messages])

  // Determine rendering strategy - default to standard with D&D
  const renderingStrategy = useMemo(() => {
    if (performanceMode === 'virtualized') return 'virtualized'
    
    // Default to standard rendering with drag-and-drop enabled
    return 'standard'
  }, [performanceMode])

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

  // Render standard list with drag-and-drop
  const renderStandardList = () => (
    <DragDropContext onDragEnd={onDragEndMessages}>
      <Droppable droppableId={`messages-${selectedId || 'none'}`}>
        {(dropProvided) => (
          <div className="col" ref={dropProvided.innerRef} {...dropProvided.droppableProps} style={{ gap: 0 }}>
            {selectedPrompt.messages.map((m, index) => (
              <Draggable key={m.id} draggableId={m.id} index={index}>
                {(dragProvided) => (
                  <MessageItem
                    message={m}
                    isCollapsed={collapsedByMessageId[m.id]}
                    isPreview={previewByMessageId[m.id]}
                    onUpdate={updateMessage}
                    onToggleCollapse={setCollapsedByMessageId}
                    onTogglePreview={setPreviewByMessageId}
                    onRemove={removeMessage}
                    MarkdownBlock={MarkdownBlock}
                    dragHandleProps={dragProvided.dragHandleProps}
                    draggableProps={dragProvided.draggableProps}
                    innerRef={dragProvided.innerRef}
                    isDragDisabled={false}
                    itemSpacing={8}
                  />
                )}
              </Draggable>
            ))}
            {dropProvided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )

  // Render virtualized list
  const renderVirtualizedList = () => (
    <div className="col">
      {VList ? (
        <VList
          height={listHeight}
          width={'100%'}
          itemCount={selectedPrompt.messages.length}
          itemSize={getItemSize}
          itemKey={(index) => selectedPrompt.messages[index]?.id || index}
        >
          {({ index, style }) => {
            const m = selectedPrompt.messages[index]
            if (!m) return <div style={style} />
            return (
              <div style={style}>
                <MessageItem
                  message={m}
                  isCollapsed={collapsedByMessageId[m.id]}
                  isPreview={previewByMessageId[m.id]}
                  onUpdate={updateMessage}
                  onToggleCollapse={setCollapsedByMessageId}
                  onTogglePreview={setPreviewByMessageId}
                  onRemove={removeMessage}
                  MarkdownBlock={MarkdownBlock}
                  isDragDisabled={true}
                />
              </div>
            )
          }}
        </VList>
      ) : (
        // Fallback to standard list if VList is not loaded
        renderStandardList()
      )}
    </div>
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
            ({selectedPrompt.messages.length} msgs, {Math.round(totalContentSize / 1024)}KB, {renderingStrategy})
          </span>
        )}
      </div>
      
      {/* Render based on strategy - default to standard with D&D */}
      {renderingStrategy === 'virtualized' ? (
        renderVirtualizedList()
      ) : (
        renderStandardList()
      )}
      
      {/* Performance notification only when virtualization is active */}
      {renderingStrategy === 'virtualized' && (
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--muted)', 
          fontStyle: 'italic', 
          marginTop: 4,
          padding: '4px 8px',
          backgroundColor: 'var(--panel-bg)',
          border: '1px solid var(--panel-border)',
          borderRadius: '4px'
        }}>
          ℹ️ Virtualized rendering active. Drag-and-drop disabled for performance with {selectedPrompt.messages.length} messages.
        </div>
      )}
      
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