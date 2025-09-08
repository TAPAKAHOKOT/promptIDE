import { useEffect, useMemo, useState } from 'react'
import './App.css'

function newPrompt(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: 'New Prompt',
    messages: [], // {id, role: 'system'|'user'|'assistant'|'tool', content}
    tools: [], // {name, description, parameters (json schema string)}
    ...overrides,
  }
}

function App() {
  const [apiKey, setApiKey] = useState('')
  const [prompts, setPrompts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // load from localStorage once
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem('openai_api_key') || ''
      const savedPrompts = JSON.parse(localStorage.getItem('prompts') || '[]')
      const savedSelected = localStorage.getItem('selected_prompt_id')
      setApiKey(savedKey)
      if (Array.isArray(savedPrompts)) setPrompts(savedPrompts)
      if (savedSelected) setSelectedId(savedSelected)
    } catch (e) {
      console.error('Failed to load state', e)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // persist
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem('openai_api_key', apiKey || '')
    } catch {}
  }, [apiKey, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem('prompts', JSON.stringify(prompts))
    } catch {}
  }, [prompts, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    try {
      if (selectedId) localStorage.setItem('selected_prompt_id', selectedId)
    } catch {}
  }, [selectedId, isLoaded])

  const selectedPrompt = useMemo(
    () => prompts.find(p => p.id === selectedId) || null,
    [prompts, selectedId]
  )

  function addPrompt() {
    const p = newPrompt()
    setPrompts(prev => [p, ...prev])
    setSelectedId(p.id)
  }

  function duplicatePrompt(id) {
    const original = prompts.find(p => p.id === id)
    if (!original) return
    const copy = newPrompt({
      title: original.title + ' (copy)',
      messages: original.messages.map(m => ({ ...m, id: crypto.randomUUID() })),
      tools: original.tools ? [...original.tools] : [],
    })
    setPrompts(prev => [copy, ...prev])
    setSelectedId(copy.id)
  }

  function deletePrompt(id) {
    setPrompts(prev => prev.filter(p => p.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function updateSelected(updater) {
    setPrompts(prev => prev.map(p => (p.id === selectedId ? updater(p) : p)))
  }

  function addMessage(role = 'user') {
    if (!selectedPrompt) return
    const msg = { id: crypto.randomUUID(), role, content: '' }
    updateSelected(p => ({ ...p, messages: [...p.messages, msg] }))
  }

  function updateMessage(id, patch) {
    updateSelected(p => ({
      ...p,
      messages: p.messages.map(m => (m.id === id ? { ...m, ...patch } : m)),
    }))
  }

  function removeMessage(id) {
    updateSelected(p => ({ ...p, messages: p.messages.filter(m => m.id !== id) }))
  }

  function addTool() {
    const tool = { name: 'toolName', description: '', parameters: '{"type":"object","properties":{}}' }
    updateSelected(p => ({ ...p, tools: [...(p.tools || []), tool] }))
  }

  function updateTool(index, patch) {
    updateSelected(p => {
      const tools = [...(p.tools || [])]
      tools[index] = { ...tools[index], ...patch }
      return { ...p, tools }
    })
  }

  function removeTool(index) {
    updateSelected(p => {
      const tools = [...(p.tools || [])]
      tools.splice(index, 1)
      return { ...p, tools }
    })
  }

  // --- Tool parameters editor helpers ---
  function parseParamsToFields(paramsString) {
    try {
      const schema = paramsString ? JSON.parse(paramsString) : {}
      const properties = schema?.properties && typeof schema.properties === 'object' ? schema.properties : {}
      const requiredList = Array.isArray(schema?.required) ? schema.required : []
      const fields = Object.entries(properties).map(([key, def]) => ({
        key,
        type: (def && def.type) || 'string',
        description: (def && def.description) || '',
        required: requiredList.includes(key),
      }))
      return fields
    } catch {
      return []
    }
  }

  function fieldsToParamsString(fields) {
    const properties = {}
    const required = []
    for (const f of fields) {
      properties[f.key] = {
        type: f.type || 'string',
        description: f.description || '',
      }
      if (f.required) required.push(f.key)
    }
    const schema = { type: 'object', properties }
    if (required.length) schema.required = required
    try {
      return JSON.stringify(schema)
    } catch {
      return '{"type":"object","properties":{}}'
    }
  }

  function addParam(index) {
    updateSelected(p => {
      const tools = [...(p.tools || [])]
      const t = { ...(tools[index] || {}) }
      const existing = parseParamsToFields(t.parameters || '')
      const baseName = 'param'
      let name = baseName
      let counter = 1
      const names = new Set(existing.map(f => f.key))
      while (names.has(name)) { name = `${baseName}${counter++}` }
      const next = [...existing, { key: name, type: 'string', description: '', required: false }]
      t.parameters = fieldsToParamsString(next)
      tools[index] = t
      return { ...p, tools }
    })
  }

  function updateParam(index, fieldIndex, patch) {
    updateSelected(p => {
      const tools = [...(p.tools || [])]
      const t = { ...(tools[index] || {}) }
      const existing = parseParamsToFields(t.parameters || '')
      const next = existing.map((f, i) => (i === fieldIndex ? { ...f, ...patch } : f))
      t.parameters = fieldsToParamsString(next)
      tools[index] = t
      return { ...p, tools }
    })
  }

  function removeParam(index, fieldIndex) {
    updateSelected(p => {
      const tools = [...(p.tools || [])]
      const t = { ...(tools[index] || {}) }
      const existing = parseParamsToFields(t.parameters || '')
      existing.splice(fieldIndex, 1)
      t.parameters = fieldsToParamsString(existing)
      tools[index] = t
      return { ...p, tools }
    })
  }

  // Chat runner state derived from selected prompt
  const [runMessages, setRunMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState('')

  useEffect(() => {
    if (selectedPrompt) {
      // try load run history for this prompt
      try {
        const saved = JSON.parse(localStorage.getItem(`run_messages_${selectedPrompt.id}`) || 'null')
        setRunMessages(Array.isArray(saved) ? saved : (selectedPrompt.messages || []))
      } catch {
        setRunMessages(selectedPrompt.messages || [])
      }
      try {
        const inputSaved = localStorage.getItem(`chat_input_${selectedPrompt.id}`) || ''
        setChatInput(inputSaved)
      } catch {
        setChatInput('')
      }
      setRunError('')
    } else {
      setRunMessages([])
      setChatInput('')
      setRunError('')
    }
  }, [selectedPrompt?.id])

  useEffect(() => {
    if (!selectedPrompt) return
    try {
      localStorage.setItem(`run_messages_${selectedPrompt.id}`, JSON.stringify(runMessages))
    } catch {}
  }, [runMessages, selectedPrompt?.id])

  useEffect(() => {
    if (!selectedPrompt) return
    try {
      localStorage.setItem(`chat_input_${selectedPrompt.id}`, chatInput)
    } catch {}
  }, [chatInput, selectedPrompt?.id])

  function mapToolsForOpenAI(p) {
    const tools = (p.tools || []).filter(t => t && t.name)
    if (!tools.length) return undefined
    const mapped = []
    for (const t of tools) {
      let schema = {}
      try {
        schema = t.parameters ? JSON.parse(t.parameters) : {}
      } catch (e) {
        // ignore invalid schema; send empty
        schema = {}
      }
      mapped.push({
        type: 'function',
        function: {
          name: t.name,
          description: t.description || '',
          parameters: schema,
        }
      })
    }
    return mapped
  }

  async function callOpenAI(messages) {
    if (!apiKey) {
      setRunError('Введите OpenAI API Key в сайдбаре')
      return null
    }
    setRunError('')
    try {
      const tools = mapToolsForOpenAI(selectedPrompt)
      const payload = {
        model: 'gpt-4o-mini',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.7,
      }
      if (tools) {
        payload.tools = tools
        payload.tool_choice = 'auto'
      }
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text}`)
      }
      const data = await res.json()
      const choice = data.choices && data.choices[0]
      const msg = choice?.message
      if (!msg) throw new Error('Пустой ответ от модели')
      // Normalize assistant message
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: msg.content || '',
        tool_calls: msg.tool_calls || [],
      }
    } catch (e) {
      const hint = 'Замечание: ключ на фронте небезопасен, а CORS может блокировать запросы. При проблемах используйте прокси/бэкенд.'
      setRunError(`${e.message}\n${hint}`)
      return null
    }
  }

  async function runOnce() {
    if (!selectedPrompt) return
    setIsRunning(true)
    try {
      const base = selectedPrompt.messages || []
      setRunMessages(base)
      const assistant = await callOpenAI(base)
      if (assistant) setRunMessages(prev => [...prev, assistant])
    } finally {
      setIsRunning(false)
    }
  }

  async function sendUserMessage() {
    if (!selectedPrompt) return
    if (!chatInput.trim()) return
    const userMsg = { id: crypto.randomUUID(), role: 'user', content: chatInput.trim() }
    const next = [...runMessages, userMsg]
    setRunMessages(next)
    setChatInput('')
    setIsRunning(true)
    try {
      const assistant = await callOpenAI(next)
      if (assistant) setRunMessages(prev => [...prev, assistant])
    } finally {
      setIsRunning(false)
    }
  }

  function saveAssistantToPrompt(indexInRun) {
    if (!selectedPrompt) return
    const msg = runMessages[indexInRun]
    if (!msg || msg.role !== 'assistant') return
    updateSelected(p => ({ ...p, messages: [...p.messages, { id: crypto.randomUUID(), role: 'assistant', content: msg.content }] }))
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', height: '100vh' }}>
      <aside style={{ borderRight: '1px solid #333', padding: '12px', overflow: 'auto' }}>
        <h2 style={{ marginTop: 0 }}>Prompt IDE</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            placeholder="OpenAI API Key"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={addPrompt}>New Prompt</button>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {prompts.map(p => (
            <div key={p.id} style={{ border: '1px solid #444', borderRadius: 6, padding: 8, background: selectedId === p.id ? '#2a2a2a' : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button onClick={() => setSelectedId(p.id)} style={{ flex: 1, textAlign: 'left' }}>{p.title || 'Untitled'}</button>
                <button onClick={() => duplicatePrompt(p.id)}>⎘</button>
                <button onClick={() => deletePrompt(p.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main style={{ padding: '16px', overflow: 'auto' }}>
        {!selectedPrompt ? (
          <div>Select or create a prompt</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 12, height: '100%' }}>
            <input
              value={selectedPrompt.title}
              onChange={e => updateSelected(p => ({ ...p, title: e.target.value }))}
              placeholder="Prompt title"
            />

            <section>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <strong>Messages</strong>
                <button onClick={() => addMessage('system')}>+ system</button>
                <button onClick={() => addMessage('user')}>+ user</button>
                <button onClick={() => addMessage('assistant')}>+ assistant</button>
                <button onClick={() => addMessage('tool')}>+ tool</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedPrompt.messages.map(m => (
                  <div key={m.id} style={{ border: '1px solid #444', borderRadius: 6, padding: 8 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <select value={m.role} onChange={e => updateMessage(m.id, { role: e.target.value })}>
                        <option value="system">system</option>
                        <option value="user">user</option>
                        <option value="assistant">assistant</option>
                        <option value="tool">tool</option>
                      </select>
                      <button onClick={() => removeMessage(m.id)}>Delete</button>
                    </div>
                    <textarea
                      value={m.content}
                      onChange={e => updateMessage(m.id, { content: e.target.value })}
                      rows={4}
                      style={{ width: '100%' }}
                      placeholder="Message content"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
                <strong>Tools</strong>
                <button onClick={addTool}>+ tool</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(selectedPrompt.tools || []).map((t, i) => (
                  <div key={i} style={{ border: '1px solid #444', borderRadius: 6, padding: 8 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <input value={t.name} onChange={e => updateTool(i, { name: e.target.value })} placeholder="Tool name" />
                      <button onClick={() => removeTool(i)}>Delete</button>
                    </div>
                    <input value={t.description} onChange={e => updateTool(i, { description: e.target.value })} placeholder="Description" />
                    <div style={{ marginTop: 8, borderTop: '1px dashed #555', paddingTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <strong>Parameters</strong>
                        <button onClick={() => addParam(i)}>+ parameter</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {parseParamsToFields(t.parameters || '').map((f, fi) => (
                          <div key={fi} style={{ border: '1px solid #555', borderRadius: 6, padding: 8 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 100px 80px', gap: 8, alignItems: 'center' }}>
                              <input
                                value={f.key}
                                onChange={e => updateParam(i, fi, { key: e.target.value })}
                                placeholder="name"
                              />
                              <select value={f.type} onChange={e => updateParam(i, fi, { type: e.target.value })}>
                                <option value="string">string</option>
                                <option value="number">number</option>
                                <option value="integer">integer</option>
                                <option value="boolean">boolean</option>
                              </select>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="checkbox"
                                  checked={!!f.required}
                                  onChange={e => updateParam(i, fi, { required: e.target.checked })}
                                />
                                required
                              </label>
                              <button onClick={() => removeParam(i, fi)}>Delete</button>
                            </div>
                            <input
                              value={f.description}
                              onChange={e => updateParam(i, fi, { description: e.target.value })}
                              placeholder="description"
                              style={{ marginTop: 6 }}
                            />
                          </div>
                        ))}
                      </div>
                      <details style={{ marginTop: 8 }}>
                        <summary>Advanced (view JSON schema)</summary>
                        <pre style={{ whiteSpace: 'pre-wrap' }}>{t.parameters || ''}</pre>
                      </details>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <strong>Chat</strong>
                <button onClick={runOnce} disabled={isRunning}>Run once</button>
                {isRunning && <span>Running...</span>}
              </div>
              {runError && (
                <div style={{ whiteSpace: 'pre-wrap', color: '#f88', border: '1px solid #633', padding: 8, borderRadius: 6, marginBottom: 8 }}>{runError}</div>
              )}
              <div style={{ border: '1px solid #444', borderRadius: 6, padding: 8, maxHeight: 280, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {runMessages.length === 0 && <div style={{ color: '#888' }}>Нет сообщений. Добавьте сообщения или нажмите Run once.</div>}
                {runMessages.map((m, idx) => (
                  <div key={m.id || idx} style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600 }}>{m.role}</div>
                    {m.content && <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>}
                    {Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontWeight: 600 }}>Tool calls:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {m.tool_calls.map((tc, i) => (
                            <div key={i} style={{ border: '1px dashed #666', borderRadius: 6, padding: 6 }}>
                              <div><strong>name:</strong> {tc?.function?.name || 'unknown'}</div>
                              <div><strong>arguments:</strong></div>
                              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{tc?.function?.arguments || ''}</pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.role === 'assistant' && (
                      <div style={{ marginTop: 6 }}>
                        <button onClick={() => saveAssistantToPrompt(idx)}>Save to prompt</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  placeholder="Type a message"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button onClick={sendUserMessage} disabled={isRunning || !chatInput.trim()}>Send</button>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
