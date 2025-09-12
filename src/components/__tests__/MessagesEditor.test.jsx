import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MessagesEditor from '../MessagesEditor'

// Mock the MessageItem component
vi.mock('../MessageItem', () => ({
  default: ({ message }) => <div data-testid={`message-${message.id}`}>{message.content}</div>
}))

// Mock react-window
vi.mock('react-window', () => ({
  VariableSizeList: ({ children, itemCount }) => (
    <div data-testid="virtualized-list">
      {Array.from({ length: itemCount }, (_, index) => 
        children({ index, style: {} })
      )}
    </div>
  )
}))

// Mock @hello-pangea/dnd
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }) => <div data-testid="drag-drop-context">{children}</div>,
  Droppable: ({ children }) => children({ innerRef: vi.fn(), droppableProps: {} }),
  Draggable: ({ children }) => children({ 
    dragHandleProps: {}, 
    draggableProps: { style: {} }, 
    innerRef: vi.fn() 
  })
}))

const mockProps = {
  selectedPrompt: {
    id: 'test-prompt',
    messages: []
  },
  selectedId: 'test-prompt',
  previewByMessageId: {},
  setPreviewByMessageId: vi.fn(),
  collapsedByMessageId: {},
  setCollapsedByMessageId: vi.fn(),
  updateMessage: vi.fn(),
  removeMessage: vi.fn(),
  addMessage: vi.fn(),
  onDragEndMessages: vi.fn(),
  MarkdownBlock: ({ content }) => <div>{content}</div>
}

describe('MessagesEditor Performance Optimization', () => {
  it('should render messages by default', () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({
      id: `msg-${i}`,
      content: 'Short message',
      role: 'user',
      enabled: true
    }))

    render(
      <MessagesEditor 
        {...mockProps} 
        selectedPrompt={{ ...mockProps.selectedPrompt, messages: messages }}
      />
    )

    // Should show all messages
    messages.forEach(msg => {
      expect(screen.getByTestId(`message-${msg.id}`)).toBeInTheDocument()
    })
    
    // Should not show virtualized list by default
    expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument()
  })

  it('should render large message lists with standard rendering by default', () => {
    const largeMessages = Array.from({ length: 15 }, (_, i) => ({
      id: `msg-${i}`,
      content: 'Message content',
      role: 'user',
      enabled: true
    }))

    render(
      <MessagesEditor 
        {...mockProps} 
        selectedPrompt={{ ...mockProps.selectedPrompt, messages: largeMessages }}
      />
    )

    // Should show all messages with standard rendering
    largeMessages.forEach(msg => {
      expect(screen.getByTestId(`message-${msg.id}`)).toBeInTheDocument()
    })
    
    // Should not show virtualized list by default
    expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument()
  })

  it('should show virtualization notification when explicitly using virtualized mode', () => {
    const messages = Array.from({ length: 3 }, (_, i) => ({
      id: `msg-${i}`,
      content: 'Short message',
      role: 'user',
      enabled: true
    }))

    render(
      <MessagesEditor 
        {...mockProps} 
        selectedPrompt={{ ...mockProps.selectedPrompt, messages: messages }}
        performanceMode="virtualized"
      />
    )

    // Should show notification about virtualization being active
    expect(screen.getByText(/Virtualized rendering active/)).toBeInTheDocument()
  })

  it('should not show virtualization notification in standard mode', () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({
      id: `msg-${i}`,
      content: 'Message content',
      role: 'user',
      enabled: true
    }))

    render(
      <MessagesEditor 
        {...mockProps} 
        selectedPrompt={{ ...mockProps.selectedPrompt, messages: messages }}
      />
    )

    // Should not show virtualization notification in standard mode
    expect(screen.queryByText(/Virtualized rendering active/)).not.toBeInTheDocument()
  })

  it('should render add message buttons', () => {
    render(
      <MessagesEditor 
        {...mockProps} 
        selectedPrompt={{ ...mockProps.selectedPrompt, messages: [] }}
      />
    )

    // Should show add message buttons
    expect(screen.getByText('+ system')).toBeInTheDocument()
    expect(screen.getByText('+ user')).toBeInTheDocument()
    expect(screen.getByText('+ assistant')).toBeInTheDocument()
    expect(screen.getByText('+ comment')).toBeInTheDocument()
  })
})