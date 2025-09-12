import React, { useState } from 'react'
import { Input, Button, Typography, Space, Card } from 'antd'
import useLocalInputState from './useLocalInputState'

const { Text, Title } = Typography

/**
 * Demo component to showcase useLocalInputState hook functionality
 */
function UseLocalInputStateDemo() {
  const [globalValue, setGlobalValue] = useState('Initial global value')
  const [syncCount, setSyncCount] = useState(0)
  const [lastSyncTime, setLastSyncTime] = useState(null)

  // Demo with default settings (300ms debounce)
  const {
    localValue: localValue1,
    setLocalValue: setLocalValue1,
    syncNow: syncNow1,
    isDirty: isDirty1,
    handleBlur: handleBlur1
  } = useLocalInputState({
    initialValue: globalValue,
    onSync: (value) => {
      setGlobalValue(value)
      setSyncCount(prev => prev + 1)
      setLastSyncTime(new Date().toLocaleTimeString())
    },
    debounceMs: 300,
    syncOnBlur: true
  })

  // Demo with longer debounce (1000ms for auto-save scenario)
  const {
    localValue: localValue2,
    setLocalValue: setLocalValue2,
    syncNow: syncNow2,
    isDirty: isDirty2
  } = useLocalInputState({
    initialValue: 'Auto-save demo text',
    onSync: (value) => {
      console.log('Auto-save triggered:', value)
    },
    debounceMs: 1000,
    syncOnBlur: false
  })

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <Title level={2}>useLocalInputState Hook Demo</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Demo 1: Standard typing with blur sync */}
        <Card title="Demo 1: Standard Input (300ms debounce + blur sync)">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              value={localValue1}
              onChange={(e) => setLocalValue1(e.target.value)}
              onBlur={handleBlur1}
              placeholder="Type here... syncs after 300ms or on blur"
              style={{
                borderColor: isDirty1 ? '#faad14' : undefined
              }}
            />
            <div>
              <Text strong>Local Value:</Text> <Text code>{localValue1}</Text>
            </div>
            <div>
              <Text strong>Global Value:</Text> <Text code>{globalValue}</Text>
            </div>
            <div>
              <Text strong>Is Dirty:</Text> <Text type={isDirty1 ? 'warning' : 'success'}>
                {isDirty1 ? 'Yes (unsaved changes)' : 'No (synced)'}
              </Text>
            </div>
            <div>
              <Text strong>Sync Count:</Text> <Text>{syncCount}</Text>
              {lastSyncTime && (
                <>
                  <Text strong> | Last Sync:</Text> <Text>{lastSyncTime}</Text>
                </>
              )}
            </div>
            <Button onClick={syncNow1} disabled={!isDirty1}>
              Sync Now
            </Button>
          </Space>
        </Card>

        {/* Demo 2: Auto-save scenario */}
        <Card title="Demo 2: Auto-save Scenario (1000ms debounce, no blur sync)">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input.TextArea
              value={localValue2}
              onChange={(e) => setLocalValue2(e.target.value)}
              placeholder="Type here... auto-saves after 1 second of inactivity"
              rows={4}
              style={{
                borderColor: isDirty2 ? '#faad14' : undefined
              }}
            />
            <div>
              <Text strong>Is Dirty:</Text> <Text type={isDirty2 ? 'warning' : 'success'}>
                {isDirty2 ? 'Yes (will auto-save in 1s)' : 'No (saved)'}
              </Text>
            </div>
            <Button onClick={syncNow2} disabled={!isDirty2}>
              Save Now
            </Button>
          </Space>
        </Card>

        {/* Usage instructions */}
        <Card title="Hook Features Demonstrated">
          <ul>
            <li><strong>Immediate UI Response:</strong> Local state updates instantly for smooth typing</li>
            <li><strong>Configurable Debounce:</strong> 300ms for typing, 1000ms for auto-save scenarios</li>
            <li><strong>Blur Synchronization:</strong> Optional immediate sync when input loses focus</li>
            <li><strong>Dirty State Tracking:</strong> Visual indicators for unsaved changes</li>
            <li><strong>Manual Sync:</strong> syncNow() function for immediate commits</li>
            <li><strong>External Updates:</strong> Handles external value changes when not dirty</li>
          </ul>
        </Card>
      </Space>
    </div>
  )
}

export default UseLocalInputStateDemo