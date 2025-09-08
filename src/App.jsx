import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  const [sharedPreview, setSharedPreview] = useState(null)
  const [copyNotice, setCopyNotice] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')

  // load from localStorage once
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem('openai_api_key') || ''
      const savedPrompts = JSON.parse(localStorage.getItem('prompts') || '[]')
      const savedSelected = localStorage.getItem('selected_prompt_id')
      const savedModel = localStorage.getItem('openai_model') || 'gpt-4o-mini'
      setApiKey(savedKey)
      if (Array.isArray(savedPrompts)) setPrompts(savedPrompts)
      if (savedSelected) setSelectedId(savedSelected)
      setModel(savedModel)
    } catch (e) {
      console.error('Failed to load state', e)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Detect shared prompt via URL (?share=...)
  useEffect(() => {
    try {
      // Prefer hash (#share=...), fallback to query (?share=...)
      const getShare = () => {
        if (window.location.hash && window.location.hash.startsWith('#')) {
          const hp = new URLSearchParams(window.location.hash.slice(1))
          const hv = hp.get('share')
          if (hv) return hv
        }
        const qp = new URLSearchParams(window.location.search)
        return qp.get('share')
      }
      const share = getShare()
      if (!share) return
      const decoded = decodeShared(share)
      if (
        decoded && (
          (decoded.kind === 'run' && decoded.run && Array.isArray(decoded.run.transcript)) ||
          Array.isArray(decoded.messages)
        )
      ) {
        setSharedPreview(decoded)
      }
    } catch (e) {
      console.error('Failed to parse shared prompt', e)
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

  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem('openai_model', model)
    } catch {}
  }, [model, isLoaded])

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

  // --- Export / Import helpers ---
  function encodeShared(obj) {
    try {
      const json = JSON.stringify(obj)
      const bytes = new TextEncoder().encode(json)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      return btoa(binary)
    } catch {
      return ''
    }
  }

  function decodeShared(b64) {
    try {
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const json = new TextDecoder().decode(bytes)
      return JSON.parse(json)
    } catch {
      return null
    }
  }

  async function copyPromptLink() {
    if (!selectedPrompt) return
    const payload = {
      kind: 'prompt',
      title: selectedPrompt.title,
      messages: selectedPrompt.messages,
      tools: selectedPrompt.tools || [],
    }
    const b64 = encodeShared(payload)
    const url = `${window.location.origin}${window.location.pathname}#share=${encodeURIComponent(b64)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyNotice('Prompt link copied')
      setTimeout(() => setCopyNotice(''), 1500)
    } catch {
      setCopyNotice('Copy failed')
      setTimeout(() => setCopyNotice(''), 1500)
    }
  }

  async function copyRunLink() {
    if (!selectedPrompt) return
    const payload = {
      kind: 'run',
      title: selectedPrompt.title,
      run: { transcript: runMessages || [] },
    }
    const b64 = encodeShared(payload)
    const url = `${window.location.origin}${window.location.pathname}#share=${encodeURIComponent(b64)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyNotice('Run link copied')
      setTimeout(() => setCopyNotice(''), 1500)
    } catch {
      setCopyNotice('Copy failed')
      setTimeout(() => setCopyNotice(''), 1500)
    }
  }

  function importSharedToMyPrompts() {
    if (!sharedPreview) return
    const created = newPrompt({
      title: sharedPreview.title || 'Imported Prompt',
      messages: Array.isArray(sharedPreview.messages) ? sharedPreview.messages.map(m => ({ ...m, id: crypto.randomUUID() })) : [],
      tools: Array.isArray(sharedPreview.tools) ? sharedPreview.tools : [],
    })
    setPrompts(prev => [created, ...prev])
    setSelectedId(created.id)
    clearSharePreview()
  }

  function clearSharePreview() {
    setSharedPreview(null)
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('share')
      if (url.hash.includes('share=')) {
        const hp = new URLSearchParams(url.hash.slice(1))
        hp.delete('share')
        url.hash = hp.toString() ? `#${hp.toString()}` : ''
      }
      window.history.replaceState({}, '', url.toString())
    } catch {}
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
  const [previewByMessageId, setPreviewByMessageId] = useState({})

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
        model: model || 'gpt-4o-mini',
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
      const loadingId = crypto.randomUUID()
      setRunMessages(prev => [...prev, { id: loadingId, role: 'assistant', content: '', loading: true }])
      const assistant = await callOpenAI(base)
      setRunMessages(prev => prev.filter(m => m.id !== loadingId))
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
      const loadingId = crypto.randomUUID()
      setRunMessages(prev => [...prev, { id: loadingId, role: 'assistant', content: '', loading: true }])
      const assistant = await callOpenAI([...next])
      setRunMessages(prev => prev.filter(m => m.id !== loadingId))
      if (assistant) setRunMessages(prev => [...prev, assistant])
    } finally {
      setIsRunning(false)
    }
  }

  function saveAssistantToPrompt(indexInRun) {
    if (!selectedPrompt) return
    const msg = runMessages[indexInRun]
    if (!msg || msg.role !== 'assistant') return
    let contentToSave = (msg.content || '').trim()
    if (!contentToSave && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      try {
        const parts = msg.tool_calls.map(tc => {
          const name = tc?.function?.name || 'unknown'
          const args = tc?.function?.arguments || ''
          return `Tool call: ${name}\narguments:\n${args}`
        })
        contentToSave = parts.join('\n\n')
      } catch {
        contentToSave = 'Tool call (details unavailable)'
      }
    }
    if (!contentToSave) return
    updateSelected(p => ({ ...p, messages: [...p.messages, { id: crypto.randomUUID(), role: 'assistant', content: contentToSave }] }))
  }

  // Read-only view for shared links
  if (sharedPreview) {
    return (
      <div style={{ height: '100vh', padding: 16 }} className="scrolly">
        <div className="panel" style={{ maxWidth: 960, margin: '0 auto' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>Shared Prompt</h2>
            <button className="btn ghost" onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy link</button>
          </div>
          <div className="col" style={{ marginTop: 12 }}>
            <div className="panel" style={{ borderColor: '#555' }}>
              <strong>Title</strong>
              <div style={{ marginTop: 6 }}>{sharedPreview.title || 'Untitled'}</div>
            </div>
            {sharedPreview.kind !== 'run' && (
              <div className="panel" style={{ borderColor: '#555' }}>
                <strong>Messages</strong>
                <div className="col" style={{ marginTop: 8 }}>
                  {(sharedPreview.messages || []).map((m, i) => (
                    <div key={i} className="panel" style={{ borderColor: '#555' }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{m.role}</div>
                      <div>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ''}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sharedPreview.kind !== 'prompt' && sharedPreview.run?.transcript && (
              <div className="panel" style={{ borderColor: '#555' }}>
                <strong>Last run transcript</strong>
                <div className="col" style={{ marginTop: 8 }}>
                  {sharedPreview.run.transcript.map((m, i) => (
                    <div key={i} className="panel" style={{ borderColor: '#555' }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{m.role}</div>
                      {m.content && <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>}
                      {Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontWeight: 600 }}>Tool calls:</div>
                          <div className="col" style={{ gap: 6 }}>
                            {m.tool_calls.map((tc, j) => (
                              <div key={j} className="panel" style={{ borderStyle: 'dashed', borderColor: '#666' }}>
                                <div><strong>name:</strong> {tc?.function?.name || 'unknown'}</div>
                                <div><strong>arguments:</strong></div>
                                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{tc?.function?.arguments || ''}</pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sharedPreview.kind !== 'run' && (
              <div className="panel" style={{ borderColor: '#555' }}>
                <strong>Tools</strong>
                <div className="col" style={{ marginTop: 8 }}>
                  {(sharedPreview.tools || []).map((t, i) => (
                    <div key={i} className="panel" style={{ borderColor: '#555' }}>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      {t.description && <div style={{ color: 'var(--muted)', marginTop: 4 }}>{t.description}</div>}
                      <details style={{ marginTop: 8 }}>
                        <summary>parameters</summary>
                        <pre style={{ whiteSpace: 'pre-wrap' }}>{typeof t.parameters === 'string' ? t.parameters : JSON.stringify(t.parameters || {}, null, 2)}</pre>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', height: '100vh' }}>
      <aside style={{ borderRight: '1px solid #333', padding: '12px', overflow: 'auto' }} className="scrolly">
        <h2 style={{ marginTop: 0 }}>Prompt IDE</h2>
        <div className="row">
          <input
            type="password"
            placeholder="OpenAI API Key"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        <div style={{ marginTop: 12 }} className="row">
          <button className="btn primary" onClick={addPrompt}>New Prompt</button>
        </div>
        <div style={{ marginTop: 12, gap: 6 }} className="col">
          {prompts.map(p => (
            <div key={p.id} className="panel" style={{ background: selectedId === p.id ? '#2a2a2a' : 'transparent' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn ghost"
                  onClick={() => setSelectedId(p.id)}
                  style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={p.title || 'Untitled'}
                >
                  {p.title || 'Untitled'}
                </button>
                <button className="btn ghost" onClick={() => duplicatePrompt(p.id)} title="Duplicate">⎘</button>
                <button className="btn danger" onClick={() => deletePrompt(p.id)} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main style={{ padding: '16px', overflow: 'auto' }} className="scrolly">
        {!selectedPrompt ? (
      <div>
            {sharedPreview ? (
              <div className="panel">
                <div className="row" style={{ marginBottom: 8 }}>
                  <strong>Shared Prompt Preview</strong>
                </div>
                <div className="col">
                  <input value={sharedPreview.title || ''} readOnly />
                  <div className="panel" style={{ borderColor: '#555' }}>
                    <strong>Messages</strong>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(sharedPreview.messages || [], null, 2)}</pre>
                  </div>
                  <div className="panel" style={{ borderColor: '#555' }}>
                    <strong>Tools</strong>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(sharedPreview.tools || [], null, 2)}</pre>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn primary" onClick={importSharedToMyPrompts}>Import to my prompts</button>
                  <button className="btn ghost" onClick={clearSharePreview}>Close preview</button>
                </div>
              </div>
            ) : (
              <div>Select or create a prompt</div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 12, height: '100%' }}>
            <div className="row">
              <input
                value={selectedPrompt.title}
                onChange={e => updateSelected(p => ({ ...p, title: e.target.value }))}
                placeholder="Prompt title"
                style={{ flex: 1 }}
              />
              <span className="select">
                <select value={model} onChange={e => setModel(e.target.value)}>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="o4-mini">o4-mini</option>
                  <option value="o3-mini">o3-mini</option>
                  <option value="gpt-4.1">gpt-4.1</option>
                  <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                </select>
              </span>
              <button className="btn ghost" onClick={copyPromptLink}>Copy prompt link</button>
              <button className="btn ghost" onClick={copyRunLink}>Copy run link</button>
              {copyNotice && <span style={{ color: 'var(--muted)' }}>{copyNotice}</span>}
            </div>

            <section>
              <div className="row" style={{ marginBottom: 8 }}>
                <strong>Messages</strong>
      </div>
              <div className="col">
                {selectedPrompt.messages.map(m => (
                  <div key={m.id} className="panel">
                    <div className="row" style={{ marginBottom: 6 }}>
                      <span className="select">
                        <select value={m.role} onChange={e => updateMessage(m.id, { role: e.target.value })}>
                          <option value="system">system</option>
                          <option value="user">user</option>
                          <option value="assistant">assistant</option>
                        </select>
                      </span>
                      <button className="btn ghost" onClick={() => setPreviewByMessageId(prev => ({ ...prev, [m.id]: !prev[m.id] }))}>
                        {previewByMessageId[m.id] ? 'Edit' : 'Preview'}
        </button>
                      <button className="btn danger" onClick={() => removeMessage(m.id)}>Delete</button>
                    </div>
                    {previewByMessageId[m.id] ? (
                      <div className="panel" style={{ borderColor: '#555' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ''}</ReactMarkdown>
                      </div>
                    ) : (
                      <textarea
                        value={m.content}
                        onChange={e => updateMessage(m.id, { content: e.target.value })}
                        rows={8}
                        placeholder="Message content (Markdown supported)"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn ghost" onClick={() => addMessage('system')}>+ system</button>
                <button className="btn ghost" onClick={() => addMessage('user')}>+ user</button>
                <button className="btn ghost" onClick={() => addMessage('assistant')}>+ assistant</button>
              </div>
            </section>

            <section>
              <div className="row" style={{ marginTop: 12, marginBottom: 8 }}>
                <strong>Tools</strong>
                <button className="btn ghost" onClick={addTool}>+ tool</button>
              </div>
              <div className="col">
                {(selectedPrompt.tools || []).map((t, i) => (
                  <div key={i} className="panel">
                    <div className="row" style={{ marginBottom: 6 }}>
                      <input value={t.name} onChange={e => updateTool(i, { name: e.target.value })} placeholder="Tool name" />
                      <button className="btn danger" onClick={() => removeTool(i)}>Delete</button>
                    </div>
                    <input value={t.description} onChange={e => updateTool(i, { description: e.target.value })} placeholder="Description" />
                    <div style={{ marginTop: 8, borderTop: '1px dashed #555', paddingTop: 8 }}>
                      <div className="row" style={{ marginBottom: 6 }}>
                        <strong>Parameters</strong>
                        <button className="btn ghost" onClick={() => addParam(i)}>+ parameter</button>
                      </div>
                      <div className="col">
                        {parseParamsToFields(t.parameters || '').map((f, fi) => (
                          <div key={fi} className="panel" style={{ borderColor: '#555' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 100px 80px', gap: 8, alignItems: 'center' }}>
                              <input
                                value={f.key}
                                onChange={e => updateParam(i, fi, { key: e.target.value })}
                                placeholder="name"
                              />
                              <span className="select">
                                <select value={f.type} onChange={e => updateParam(i, fi, { type: e.target.value })}>
                                  <option value="string">string</option>
                                  <option value="number">number</option>
                                  <option value="integer">integer</option>
                                  <option value="boolean">boolean</option>
                                </select>
                              </span>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="checkbox"
                                  checked={!!f.required}
                                  onChange={e => updateParam(i, fi, { required: e.target.checked })}
                                />
                                required
                              </label>
                              <button className="btn danger" onClick={() => removeParam(i, fi)}>Delete</button>
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
              <div className="row" style={{ marginBottom: 8 }}>
                <strong>Chat</strong>
                <button className="btn primary" onClick={runOnce} disabled={isRunning}>Run once</button>
                {isRunning && <span className="spinner" />}
              </div>
              {runError && (
                <div style={{ whiteSpace: 'pre-wrap', color: '#f88', border: '1px solid #633', padding: 8, borderRadius: 6, marginBottom: 8 }}>{runError}</div>
              )}
              <div className="panel scrolly" style={{ maxHeight: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {runMessages.length === 0 && <div style={{ color: '#888' }}>Нет сообщений. Добавьте сообщения или нажмите Run once.</div>}
                {runMessages.map((m, idx) => (
                  <div key={m.id || idx} style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600 }}>{m.role}</div>
                    {m.loading ? (
                      <div className="panel shimmer" style={{ height: 48, borderColor: '#555' }} />
                    ) : (
                      m.content && <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    )}
                    {Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontWeight: 600 }}>Tool calls:</div>
                        <div className="col" style={{ gap: 6 }}>
                          {m.tool_calls.map((tc, i) => (
                            <div key={i} className="panel" style={{ borderStyle: 'dashed', borderColor: '#666' }}>
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
              <div className="row" style={{ marginTop: 8 }}>
                <input
                  placeholder="Type a message"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn primary" onClick={sendUserMessage} disabled={isRunning || !chatInput.trim()}>Send</button>
              </div>
            </section>
          </div>
        )}
      </main>
      </div>
  )
}

export default App
