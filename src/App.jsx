import { useEffect, useMemo, useRef, useState } from 'react'
import { ConfigProvider, Layout, Button, Input, Segmented, Typography, Space, Select, message, Switch, Checkbox, Collapse, Alert, Spin, App as AntApp, Popconfirm } from 'antd'
import { theme as antdTheme } from 'antd'
import { SunOutlined, MoonOutlined, CopyOutlined, DeleteOutlined, HolderOutlined, DownOutlined, RightOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import './App.css'
import logo from './assets/logo.png'
import LZString from 'lz-string'

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
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'dark' } catch { return 'dark' }
  })
  const [messageApi, messageContextHolder] = message.useMessage()
  const importInputRef = useRef(null)

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

  // Detect shared prompt via URL (#id=... or #share=...)
  useEffect(() => {
    const load = async () => {
      try {
        const fromHashOrSearch = (key) => {
          if (window.location.hash && window.location.hash.startsWith('#')) {
            const hp = new URLSearchParams(window.location.hash.slice(1))
            const hv = hp.get(key)
            if (hv) return hv
          }
          const qp = new URLSearchParams(window.location.search)
          return qp.get(key)
        }
        const id = fromHashOrSearch('id')
        if (id && getShareBase()) {
          const fetched = await fetchSharedById(id)
          if (
            fetched && (
              (fetched.kind === 'run' && fetched.run && Array.isArray(fetched.run.transcript)) ||
              Array.isArray(fetched.messages)
            )
          ) {
            setSharedPreview(fetched)
            return
          }
        }
        const share = fromHashOrSearch('share')
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
    }
    load()
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch {}
  }, [theme])

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
    // Preserve per-message preview state by remapping original IDs to new ones
    try {
      const raw = localStorage.getItem(`preview_state_${original.id}`)
      const prevMap = raw ? JSON.parse(raw) : {}
      if (prevMap && typeof prevMap === 'object') {
        const newMap = {}
        for (let i = 0; i < original.messages.length && i < copy.messages.length; i++) {
          const origId = original.messages[i]?.id
          const newId = copy.messages[i]?.id
          if (origId && newId && prevMap[origId]) newMap[newId] = true
        }
        localStorage.setItem(`preview_state_${copy.id}`, JSON.stringify(newMap))
      }
    } catch {}
    // Preserve per-message collapsed state by remapping original IDs to new ones
    try {
      const rawCollapsed = localStorage.getItem(`collapsed_state_${original.id}`)
      const prevCollapsed = rawCollapsed ? JSON.parse(rawCollapsed) : {}
      if (prevCollapsed && typeof prevCollapsed === 'object') {
        const newCollapsed = {}
        for (let i = 0; i < original.messages.length && i < copy.messages.length; i++) {
          const origId = original.messages[i]?.id
          const newId = copy.messages[i]?.id
          if (origId && newId && prevCollapsed[origId]) newCollapsed[newId] = true
        }
        localStorage.setItem(`collapsed_state_${copy.id}`, JSON.stringify(newCollapsed))
      }
    } catch {}
    // Preserve Tools panel open/closed state
    try {
      const toolsOpen = localStorage.getItem(`tools_panel_open_${original.id}`)
      if (toolsOpen != null) localStorage.setItem(`tools_panel_open_${copy.id}`, toolsOpen)
    } catch {}
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
    const msg = { id: crypto.randomUUID(), role, content: '', enabled: true }
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
    const tool = { name: 'toolName', description: '', parameters: '{"type":"object","properties":{}}', enabled: true }
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

  // --- DnD: prompts list reordering ---
  function reorder(list, startIndex, endIndex) {
    const result = Array.from(list)
    const [removed] = result.splice(startIndex, 1)
    result.splice(endIndex, 0, removed)
    return result
  }

  function onDragEndPrompts(result) {
    const { source, destination } = result || {}
    if (!destination) return
    if (source.index === destination.index) return
    setPrompts(prev => reorder(prev, source.index, destination.index))
  }

  // --- DnD: messages reordering (handle-only) ---
  function onDragEndMessages(result) {
    const { source, destination } = result || {}
    if (!destination) return
    if (source.index === destination.index) return
    setPrompts(prev => prev.map(p => {
      if (p.id !== selectedId) return p
      const base = Array.isArray(p.messages) ? p.messages : []
      const next = reorder(base, source.index, destination.index)
      return { ...p, messages: next }
    }))
  }

  // --- Export / Import helpers ---
  function encodeShared(obj) {
    try {
      const json = JSON.stringify(obj)
      const compressed = LZString.compressToEncodedURIComponent(json)
      if (compressed && compressed.length > 0) return compressed
      // Fallback to base64 if compression fails
      const bytes = new TextEncoder().encode(json)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      return btoa(binary)
    } catch {
      return ''
    }
  }

  // Optional share service helpers (short links via UUID)
  function getShareBase() {
    try {
      const base = import.meta.env.VITE_SHARE_BASE_URL || ''
      return base ? String(base).replace(/\/+$/g, '') : ''
    } catch {
      return ''
    }
  }

  async function fetchSharedById(id) {
    const base = getShareBase()
    if (!base || !id) return null
    try {
      const res = await fetch(`${base}/share/${encodeURIComponent(id)}`)
      if (!res.ok) return null
      // Expect either raw payload or { data: payload }
      const body = await res.json().catch(() => null)
      if (!body) return null
      if (body && typeof body === 'object' && (body.kind || body.messages || body.run || body.tools)) return body
      if (body && typeof body === 'object' && body.data) return body.data
      return null
    } catch {
      return null
    }
  }

  async function uploadSharedPayload(payload) {
    const base = getShareBase()
    if (!base || !payload) return null
    // Try POST /share -> { id }
    try {
      const res = await fetch(`${base}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const js = await res.json().catch(() => null)
        const id = js?.id || js?.uuid || js?.key
        if (typeof id === 'string' && id) return id
      }
    } catch {}
    // Fallback: PUT /share/:id we generate
    try {
      const id = crypto.randomUUID()
      const put = await fetch(`${base}/share/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (put.ok) return id
    } catch {}
    return null
  }

  // Shlink config + shortener (preferred over generic shortener when present)
  function getShlinkConfig() {
    try {
      const base = import.meta.env.VITE_SHLINK_BASE_URL || ''
      const apiKey = import.meta.env.VITE_SHLINK_API_KEY || ''
      const domain = import.meta.env.VITE_SHLINK_DOMAIN || ''
      return {
        base: base ? String(base).replace(/\/+$/g, '') : '',
        apiKey: apiKey || '',
        domain: domain || '',
      }
    } catch(e) {
      return { base: '', apiKey: '', domain: '' }
    }
  }

  async function shortenWithShlink(longUrl) {
    try {
      const { base, apiKey, domain } = getShlinkConfig()
      if (!base || !apiKey) return null
      const res = await fetch(`${base}/rest/v3/short-urls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({ longUrl, findIfExists: true, ...(domain ? { domain } : {}) }),
      })
      if (!res.ok) return null
      const js = await res.json().catch(() => null)
      if (!js) return null
      if (typeof js === 'string' && /^https?:\/\//i.test(js)) return js
      if (typeof js?.shortUrl === 'string' && /^https?:\/\//i.test(js.shortUrl)) return js.shortUrl
      if (js?.shortUrl && typeof js.shortUrl.shortUrl === 'string') return js.shortUrl.shortUrl
      if (js?.shortCode) {
        const host = domain || ((() => { try { return new URL(base).host } catch { return '' } })())
        if (host && js.shortCode) return `https://${host}/${js.shortCode}`
      }
      return null
    } catch(e) {
      return null
    }
  }

  // Optional external shortener for long URLs (no backend). Expects plain-text short URL response
  async function shortenUrlIfConfigured(longUrl) {
    try {
      const base = import.meta.env.VITE_SHORTENER_BASE || ''
      if (!base) return null
      const endpoint = `${String(base).replace(/\/+$/g, '')}?url=${encodeURIComponent(longUrl)}`
      const res = await fetch(endpoint)
      if (!res.ok) return null
      const text = (await res.text()).trim()
      if (text && /^https?:\/\//i.test(text)) return text
      return null
    } catch {
      return null
    }
  }

  function decodeShared(b64) {
    // Prefer LZString first (new format)
    try {
      const json = LZString.decompressFromEncodedURIComponent(b64)
      if (json && typeof json === 'string') return JSON.parse(json)
    } catch {}
    // Fallback: old base64 format
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
      messages: (selectedPrompt.messages || []).filter(m => m && m.enabled !== false),
      tools: (selectedPrompt.tools || []).filter(t => t && t.enabled !== false),
    }
    let url = ''
    // Prefer short link via backend if configured
    try {
      const base = getShareBase()
      if (base) {
        const id = await uploadSharedPayload(payload)
        if (id) url = `${window.location.origin}${window.location.pathname}#id=${encodeURIComponent(id)}`
      }
    } catch {}
    if (!url) {
      const val = encodeShared(payload)
      const hp = new URLSearchParams()
      hp.set('share', val)
      url = `${window.location.origin}${window.location.pathname}#${hp.toString()}`
    }
    // Try to shorten via Shlink first (if no backend id link)
    if (!getShareBase()) {
      try {
        const sh = await shortenWithShlink(url)
        if (sh) url = sh
        else {
          const shorted = await shortenUrlIfConfigured(url)
          if (shorted) url = shorted
        }
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url)
      messageApi.success('Link copied')
      setCopyNotice('Link copied')
      setTimeout(() => setCopyNotice(''), 1500)
    } catch {
      messageApi.error('Copy failed')
      setCopyNotice('Copy failed')
      setTimeout(() => setCopyNotice(''), 1500)
    }
  }

  // Export selected prompt as JSON file
  function exportSelectedPromptAsJson() {
    if (!selectedPrompt) return
    try {
      const payload = {
        kind: 'prompt',
        version: 2,
        title: selectedPrompt.title || 'Untitled',
        messages: (selectedPrompt.messages || []).map(m => ({
          role: m?.role || 'user',
          content: m?.content || '',
          enabled: m?.enabled !== false,
          preview: !!previewByMessageId[m?.id],
          collapsed: !!collapsedByMessageId[m?.id],
          label: m?.label || '',
        })),
        tools: (selectedPrompt.tools || []).map(t => ({
          name: t?.name || 'toolName',
          description: t?.description || '',
          parameters: typeof t?.parameters === 'string' ? t.parameters : JSON.stringify(t?.parameters || { type: 'object', properties: {} }),
          enabled: t?.enabled !== false,
        })),
        toolsPanelOpen: getToolsPanelDefault(selectedPrompt.id),
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const base = (selectedPrompt.title || 'prompt').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')
      a.href = url
      a.download = `${base || 'prompt'}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      messageApi.success('JSON экспортирован')
    } catch {
      messageApi.error('Не удалось экспортировать JSON')
    }
  }

  // Open file dialog for importing prompt JSON
  function triggerImportJson() {
    if (importInputRef.current) importInputRef.current.click()
  }

  // Handle JSON import from file
  function onImportJsonChange(e) {
    const file = e?.target?.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const data = JSON.parse(text)
        const messages = Array.isArray(data?.messages) ? data.messages : []
        const tools = Array.isArray(data?.tools) ? data.tools : []
        const createdMessages = messages.map(m => ({
          id: crypto.randomUUID(),
          role: m?.role || 'user',
          content: m?.content || '',
          enabled: m?.enabled !== false,
          __preview: !!m?.preview,
          __collapsed: !!m?.collapsed,
          label: typeof m?.label === 'string' ? m.label : '',
        }))
        const created = newPrompt({
          title: (typeof data?.title === 'string' && data.title.trim()) ? data.title.trim() : 'Imported Prompt',
          messages: createdMessages.map(({ __preview, ...rest }) => rest),
          tools: tools.map(t => ({
            name: t?.name || 'toolName',
            description: t?.description || '',
            parameters: typeof t?.parameters === 'string' ? t.parameters : JSON.stringify(t?.parameters || { type: 'object', properties: {} }),
            enabled: t?.enabled !== false,
          })),
        })
        // Persist preview and collapsed state for this prompt before selecting it
        try {
          const previewMap = {}
          const collapsedMap = {}
          for (const m of createdMessages) {
            if (m.__preview) previewMap[m.id] = true
            if (m.__collapsed) collapsedMap[m.id] = true
          }
          localStorage.setItem(`preview_state_${created.id}`, JSON.stringify(previewMap))
          localStorage.setItem(`collapsed_state_${created.id}`, JSON.stringify(collapsedMap))
        } catch {}
        // Restore Tools panel open/closed state from imported JSON
        try {
          if (typeof data?.toolsPanelOpen === 'boolean') {
            localStorage.setItem(`tools_panel_open_${created.id}`, data.toolsPanelOpen ? '1' : '0')
          }
        } catch {}
        setPrompts(prev => [created, ...prev])
        setSelectedId(created.id)
        messageApi.success('Промпт импортирован')
      } catch {
        messageApi.error('Не удалось импортировать JSON')
      } finally {
        if (e?.target) e.target.value = ''
      }
    }
    reader.onerror = () => {
      messageApi.error('Ошибка чтения файла')
      if (e?.target) e.target.value = ''
    }
    reader.readAsText(file)
  }

  function importSharedToMyPrompts() {
    if (!sharedPreview) return
    const created = newPrompt({
      title: sharedPreview.title || 'Imported Prompt',
      messages: Array.isArray(sharedPreview.messages)
        ? sharedPreview.messages.map(m => ({ ...m, id: crypto.randomUUID(), enabled: m?.enabled !== false }))
        : [],
      tools: Array.isArray(sharedPreview.tools)
        ? (sharedPreview.tools || []).map(t => ({ ...t, enabled: t?.enabled !== false }))
        : [],
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
      url.searchParams.delete('id')
      if (url.hash) {
        const hp = new URLSearchParams(url.hash.slice(1))
        hp.delete('share')
        hp.delete('id')
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
  const [collapsedByMessageId, setCollapsedByMessageId] = useState({})

  useEffect(() => {
    if (selectedPrompt) {
      // load saved assistant-only transcript for this prompt; default to empty
      try {
        const saved = JSON.parse(localStorage.getItem(`run_messages_${selectedPrompt.id}`) || 'null')
        setRunMessages(Array.isArray(saved) ? saved : [])
      } catch {
        setRunMessages([])
      }
      try {
        const inputSaved = localStorage.getItem(`chat_input_${selectedPrompt.id}`) || ''
        setChatInput(inputSaved)
      } catch {
        setChatInput('')
      }
      try {
        const previewSaved = JSON.parse(localStorage.getItem(`preview_state_${selectedPrompt.id}`) || 'null')
        setPreviewByMessageId(previewSaved && typeof previewSaved === 'object' ? previewSaved : {})
      } catch {
        setPreviewByMessageId({})
      }
      try {
        const collapsedSaved = JSON.parse(localStorage.getItem(`collapsed_state_${selectedPrompt.id}`) || 'null')
        setCollapsedByMessageId(collapsedSaved && typeof collapsedSaved === 'object' ? collapsedSaved : {})
      } catch {
        setCollapsedByMessageId({})
      }
      setRunError('')
    } else {
      setRunMessages([])
      setChatInput('')
      setRunError('')
      setPreviewByMessageId({})
      setCollapsedByMessageId({})
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

  useEffect(() => {
    if (!selectedPrompt) return
    try {
      localStorage.setItem(`preview_state_${selectedPrompt.id}`, JSON.stringify(previewByMessageId || {}))
    } catch {}
  }, [previewByMessageId, selectedPrompt?.id])

  useEffect(() => {
    if (!selectedPrompt) return
    try {
      localStorage.setItem(`collapsed_state_${selectedPrompt.id}`, JSON.stringify(collapsedByMessageId || {}))
    } catch {}
  }, [collapsedByMessageId, selectedPrompt?.id])

  // Persisted UI state: Tools panel open/closed per prompt
  const getToolsPanelDefault = (pid) => {
    try {
      const saved = pid ? localStorage.getItem(`tools_panel_open_${pid}`) : null
      return saved == null ? true : (saved === '1' || saved === 'true')
    } catch {
      return true
    }
  }

  function mapToolsForOpenAI(p) {
    const tools = (p.tools || []).filter(t => t && t.name && t.enabled !== false)
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
        messages: messages
          .filter(m => m.role !== 'comment')
          .filter(m => m.enabled !== false)
          .map(m => ({ role: m.role, content: m.content })),
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

  async function runPrompt() {
    if (!selectedPrompt) return
    setIsRunning(true)
    try {
      const base = selectedPrompt.messages || []
      // show only model replies in the chat
      setRunMessages([])
      const loadingId = crypto.randomUUID()
      setRunMessages(prev => [...prev, { id: loadingId, role: 'assistant', content: '', loading: true }])
      const assistant = await callOpenAI(base)
      setRunMessages(prev => prev.filter(m => m.id !== loadingId))
      if (assistant) setRunMessages(prev => [...prev, assistant])
    } finally {
      setIsRunning(false)
      messageApi.success('Prompt run completed')
    }
  }

  async function sendUserMessage() {
    if (!selectedPrompt) return
    if (!chatInput.trim()) return
    const userMsg = { id: crypto.randomUUID(), role: 'user', content: chatInput.trim() }
    const base = selectedPrompt.messages || []
    const next = [...base, userMsg]
    setChatInput('')
    setIsRunning(true)
    try {
      const loadingId = crypto.randomUUID()
      // replace chat with only assistant loading placeholder
      setRunMessages([{ id: loadingId, role: 'assistant', content: '', loading: true }])
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
    const hasTools = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
    if (!contentToSave && hasTools) {
      try {
        const parts = msg.tool_calls.map(tc => {
          const name = tc?.function?.name || 'unknown'
          const args = tc?.function?.arguments || ''
          let argsString = ''
          try {
            const parsed = args ? JSON.parse(args) : {}
            if (Array.isArray(parsed)) {
              parsed.forEach(arg => {
                if (arg && typeof arg === 'object') {
                  const n = Object.prototype.hasOwnProperty.call(arg, 'name') ? arg.name : 'value'
                  const v = Object.prototype.hasOwnProperty.call(arg, 'value') ? arg.value : arg
                  argsString += `_${n}:_ ${typeof v === 'object' ? JSON.stringify(v) : String(v)}\n`
                } else {
                  argsString += `_value:_ ${String(arg)}\n`
                }
              })
            } else if (parsed && typeof parsed === 'object') {
              Object.entries(parsed).forEach(([k, v]) => {
                argsString += `_${k}:_ ${typeof v === 'object' ? JSON.stringify(v) : String(v)}\n`
              })
            } else if (parsed != null) {
              argsString += String(parsed)
            }
          } catch {
            argsString = String(args || '')
          }
          return `**Tool call:** ${name}\n**arguments:**\n${argsString}`
        })
        contentToSave = parts.join('\n\n')
      } catch {
        contentToSave = 'Tool call (details unavailable)'
      }
    }
    if (!contentToSave) return
    const mId = crypto.randomUUID();
    updateSelected(p => ({ ...p, messages: [...p.messages, { id: mId, role: hasTools ? 'comment' : 'assistant', prev: 'Preview', content: contentToSave }] }))
    setPreviewByMessageId(prev => ({ ...prev, [mId]: 'Preview' }))
  }

  // Read-only view for shared links
  if (sharedPreview) {
    return (
      <div style={{ height: '100vh', padding: 16 }} className="scrolly">
        {messageContextHolder}
        <div className="panel" style={{ maxWidth: 960, margin: '0 auto' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>Shared Prompt</h2>
            <Segmented
              value={theme}
              onChange={val => setTheme(val)}
              options={[
                { label: <SunOutlined />, value: 'light' },
                { label: <MoonOutlined />, value: 'dark' },
              ]}
            />
          </div>
          <div className="col" style={{ marginTop: 12 }}>
            <div className="panel" style={{ borderColor: 'var(--panel-border)' }}>
              <strong>Title</strong>
              <div style={{ marginTop: 6 }}>{sharedPreview.title || 'Untitled'}</div>
            </div>
            {sharedPreview.kind !== 'run' && (
              <div className="panel" style={{ borderColor: 'var(--panel-border)' }}>
                <strong>Messages</strong>
                <div className="col" style={{ marginTop: 8 }}>
                  {(sharedPreview.messages || []).map((m, i) => (
                    <div key={i} className="panel" style={{ borderColor: 'var(--panel-border)' }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{m.role}</div>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ''}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sharedPreview.kind !== 'prompt' && sharedPreview.run?.transcript && (
              <div className="panel" style={{ borderColor: 'var(--panel-border)' }}>
                <strong>Last run transcript</strong>
                <div className="col" style={{ marginTop: 8 }}>
                  {sharedPreview.run.transcript.map((m, i) => (
                    <div key={i} className="panel" style={{ borderColor: 'var(--panel-border)' }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{m.role}</div>
                      {m.content && <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ''}</ReactMarkdown>}
                      {Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontWeight: 600 }}>Tool calls:</div>
                          <div className="col" style={{ gap: 6 }}>
                            {m.tool_calls.map((tc, j) => (
                              <div key={j} className="panel" style={{ borderStyle: 'dashed', borderColor: 'var(--panel-border)' }}>
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
            {sharedPreview.kind !== 'run' && Array.isArray(sharedPreview.tools) && sharedPreview.tools.length > 0 && (
              <div className="panel" style={{ borderColor: 'var(--panel-border)' }}>
                <strong>Tools</strong>
                <div className="col" style={{ marginTop: 8 }}>
                  {(sharedPreview.tools || []).map((t, i) => (
                    <div key={i} className="panel" style={{ borderColor: 'var(--panel-border)' }}>
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
    <ConfigProvider theme={{ algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
      <AntApp>
      {messageContextHolder}
      <Layout style={{ height: '100vh' }}>
        <Layout.Sider width={280} style={{ background: 'transparent', borderRight: '1px solid var(--panel-border)' }}>
          <div style={{ padding: 12 }} className="scrolly">
            <Typography.Title level={4} style={{ marginTop: 0, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={logo} alt="Prompt IDE logo" style={{ width: 20, height: 20 }} />
              <span>Prompt IDE</span>
            </Typography.Title>
            <div className="row">
              <Input.Password
                placeholder="OpenAI API Key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <Segmented
                value={theme}
                onChange={val => setTheme(val)}
                options={[
                  { label: <SunOutlined />, value: 'light' },
                  { label: <MoonOutlined />, value: 'dark' },
                ]}
              />
            </div>
            <div style={{ marginTop: 12 }} className="row">
              <Button size="small" type="primary" onClick={addPrompt}>New</Button>
              <Button size="small" onClick={triggerImportJson}>Import</Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={onImportJsonChange}
                style={{ display: 'none' }}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <DragDropContext onDragEnd={onDragEndPrompts}>
                <Droppable droppableId="prompts">
                  {(dropProvided) => (
                    <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                      {prompts.map((p, index) => (
                        <Draggable key={p.id} draggableId={p.id} index={index}>
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className="prompt-item"
                              style={{
                                padding: 8,
                                marginBottom: 8,
                                background: selectedId === p.id ? 'var(--selected-bg)' : undefined,
                                borderRadius: 8,
                                border: '1px solid var(--panel-border)',
                                cursor: 'grab',
                                ...dragProvided.draggableProps.style,
                              }}
                              onClick={() => setSelectedId(p.id)}
                            >
                              <div className="row" style={{ justifyContent: 'space-between' }}>
                                <span className="truncate">{p.title || 'Untitled'}</span>
                                <div className="row" onClick={e => e.stopPropagation()}>
                                  <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => duplicatePrompt(p.id)} title="Duplicate" />
                                  <Popconfirm
                                    title="Удалить промпт?"
                                    description={`Удалить "${p.title || 'Untitled'}"? Это действие необратимо.`}
                                    okText="Удалить"
                                    cancelText="Отмена"
                                    onConfirm={() => deletePrompt(p.id)}
                                  >
                                    <Button size="small" danger type="text" icon={<DeleteOutlined />} title="Delete" />
                                  </Popconfirm>
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
            </div>
          </div>
        </Layout.Sider>
        <Layout>
          <Layout.Content style={{ padding: 16 }} className="scrolly">
        {!selectedPrompt ? (
      <div>
            {sharedPreview ? (
              <div className="panel">
                <div className="row" style={{ marginBottom: 8 }}>
                  <strong>Shared Prompt Preview</strong>
                </div>
                <div className="col">
                  <Input value={sharedPreview.title || ''} readOnly />
                  <div className="panel" style={{ borderColor: 'var(--panel-border)' }}>
                    <strong>Messages</strong>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(sharedPreview.messages || [], null, 2)}</pre>
                  </div>
                  <div className="panel" style={{ borderColor: 'var(--panel-border)' }}>
                    <strong>Tools</strong>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(sharedPreview.tools || [], null, 2)}</pre>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <Button size="small" type="primary" onClick={importSharedToMyPrompts}>Import to my prompts</Button>
                  <Button size="small" onClick={clearSharePreview}>Close preview</Button>
                </div>
              </div>
            ) : (
              <div>Select or create a prompt</div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 12, height: '100%' }}>
            <div className="row">
              <Input
                value={selectedPrompt.title}
                onChange={e => updateSelected(p => ({ ...p, title: e.target.value }))}
                placeholder="Prompt title"
                style={{ flex: 1 }}
              />
              <Select
                value={model}
                onChange={setModel}
                style={{ width: 180 }}
                options={[
                  { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
                  { value: 'gpt-4o', label: 'gpt-4o' },
                  { value: 'o4-mini', label: 'o4-mini' },
                  { value: 'o3-mini', label: 'o3-mini' },
                  { value: 'gpt-4.1', label: 'gpt-4.1' },
                  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
                  { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
                ]}
              />
              <Button onClick={copyPromptLink}>Share</Button>
              <Button onClick={exportSelectedPromptAsJson} disabled={!selectedPrompt}>Export</Button>
            </div>

            <section>
              <div className="row" style={{ marginBottom: 8 }}>
                <strong>Messages</strong>
      </div>
              <DragDropContext onDragEnd={onDragEndMessages}>
                <Droppable droppableId={`messages-${selectedId || 'none'}`}>
                  {(dropProvided) => (
                    <div className="col" ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                      {selectedPrompt.messages.map((m, index) => (
                        <Draggable key={m.id} draggableId={m.id} index={index}>
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className="panel"
                              style={{ opacity: m.enabled !== false ? 1 : 0.5, ...dragProvided.draggableProps.style }}
                            >
                              <div className="row" style={{ marginBottom: 6 }}>
                                <span
                                  {...dragProvided.dragHandleProps}
                                  title="Drag to reorder"
                                  style={{ display: 'inline-flex', alignItems: 'center', cursor: 'grab', color: 'var(--muted)' }}
                                >
                                  <HolderOutlined />
                                </span>
                                <Button type="text" size="small" onClick={() => setCollapsedByMessageId(prev => ({ ...prev, [m.id]: !prev[m.id] }))}>
                                  {collapsedByMessageId[m.id] ? <RightOutlined /> : <DownOutlined /> }
                                </Button>
                                <Select
                                  size="small"
                                  value={m.role}
                                  onChange={val => updateMessage(m.id, { role: val })}
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
                                  value={m.label || ''}
                                  onChange={e => updateMessage(m.id, { label: e.target.value })}
                                  placeholder="label"
                                  style={{ width: 160 }}
                                />
                                <Button size="small" onClick={() => setPreviewByMessageId(prev => ({ ...prev, [m.id]: !prev[m.id] }))}>
                                  {previewByMessageId[m.id] ? 'Edit' : 'Preview'}
                                </Button>
                                <Switch
                                  size="small"
                                  checked={m.enabled !== false}
                                  onChange={val => updateMessage(m.id, { enabled: val })}
                                />
                                <Popconfirm
                                  title="Удалить сообщение?"
                                  okText="Удалить"
                                  cancelText="Отмена"
                                  onConfirm={() => removeMessage(m.id)}
                                >
                                  <Button size="small" type="text" danger icon={<DeleteOutlined />} title="Delete" />
                                </Popconfirm>
                              </div>
                              {!collapsedByMessageId[m.id] && (
                                previewByMessageId[m.id] ? (
                                  <div className="panel" style={{ borderColor: 'var(--panel-border)' }}>
                                    <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 0.5 }}>
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ''}</ReactMarkdown>
                                    </Typography.Paragraph>
                                  </div>
                                ) : (
                                  <Input.TextArea
                                    value={m.content}
                                    onChange={e => updateMessage(m.id, { content: e.target.value })}
                                    rows={8}
                                    placeholder="Message content (Markdown supported)"
                                  />
                                )
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {dropProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              <div className="row" style={{ marginTop: 8 }}>
                <Button size="small" onClick={() => addMessage('system')}>+ system</Button>
                <Button size="small" onClick={() => addMessage('user')}>+ user</Button>
                <Button size="small" onClick={() => addMessage('assistant')}>+ assistant</Button>
                <Button size="small" onClick={() => addMessage('comment')}>+ comment</Button>
              </div>
            </section>

            <section>
              <Collapse
                key={`tools-${selectedPrompt?.id || 'none'}`}
                defaultActiveKey={getToolsPanelDefault(selectedPrompt?.id) ? ['tools'] : []}
                onChange={(keys) => {
                  const isOpen = Array.isArray(keys) ? keys.includes('tools') : keys === 'tools'
                  try { if (selectedPrompt) localStorage.setItem(`tools_panel_open_${selectedPrompt.id}`, isOpen ? '1' : '0') } catch {}
                }}
                style={{ marginTop: 12, marginBottom: 8 }}
              >
                <Collapse.Panel
                  header="Tools"
                  key="tools"
                  extra={(
                    <Button
                      size="small"
                      onClick={(e) => { e.stopPropagation(); addTool() }}
                    >
                      + tool
                    </Button>
                  )}
                >
                  <div className="col">
                    {(selectedPrompt.tools || []).map((t, i) => (
                      <div key={i} className="panel" style={{ opacity: t.enabled !== false ? 1 : 0.5 }}>
                        <div className="row" style={{ marginBottom: 6 }}>
                          <Input value={t.name} onChange={e => updateTool(i, { name: e.target.value })} placeholder="Tool name" />
                          <Switch size="small" checked={t.enabled !== false} onChange={val => updateTool(i, { enabled: val })} />
                          <Popconfirm
                            title="Удалить tool?"
                            okText="Удалить"
                            cancelText="Отмена"
                            onConfirm={() => removeTool(i)}
                          >
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} title="Delete" />
                          </Popconfirm>
                        </div>
                        <Input value={t.description} onChange={e => updateTool(i, { description: e.target.value })} placeholder="Description" />
                        <div style={{ marginTop: 8, borderTop: '1px dashed var(--panel-border)', paddingTop: 8 }}>
                          <div className="row" style={{ marginBottom: 6 }}>
                            <strong>Parameters</strong>
                            <Button size="small" onClick={() => addParam(i)}>+ parameter</Button>
                          </div>
                          <div className="col">
                            {parseParamsToFields(t.parameters || '').map((f, fi) => (
                              <div key={fi} className="panel" style={{ borderColor: 'var(--panel-border)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 80px', gap: 8, alignItems: 'center' }}>
                                  <Input
                                    value={f.key}
                                    onChange={e => updateParam(i, fi, { key: e.target.value })}
                                    placeholder="name"
                                  />
                                  <Select
                                    value={f.type}
                                    onChange={val => updateParam(i, fi, { type: val })}
                                    options={[
                                      { value: 'string', label: 'string' },
                                      { value: 'number', label: 'number' },
                                      { value: 'integer', label: 'integer' },
                                      { value: 'boolean', label: 'boolean' },
                                    ]}
                                  />
                                  <Checkbox
                                    checked={!!f.required}
                                    onChange={e => updateParam(i, fi, { required: e.target.checked })}
                                  >required</Checkbox>
                                  <Popconfirm
                                    title="Удалить параметр?"
                                    okText="Удалить"
                                    cancelText="Отмена"
                                    onConfirm={() => removeParam(i, fi)}
                                  >
                                    <Button type="text" size="small" danger icon={<DeleteOutlined />} title="Delete" />
                                  </Popconfirm>
                                </div>
                                <Input
                                  value={f.description}
                                  onChange={e => updateParam(i, fi, { description: e.target.value })}
                                  placeholder="description"
                                  style={{ marginTop: 6 }}
                                />
                              </div>
                            ))}
                          </div>
                          <Collapse style={{ marginTop: 8 }}>
                            <Collapse.Panel header="Advanced (view JSON schema)" key="1">
                              <pre style={{ whiteSpace: 'pre-wrap' }}>{t.parameters || ''}</pre>
                            </Collapse.Panel>
                          </Collapse>
                        </div>
                      </div>
                    ))}
                  </div>
                </Collapse.Panel>
              </Collapse>
            </section>

            <section style={{ marginTop: 12, paddingBottom: 24 }}>
              <div className="row" style={{ marginBottom: 8 }}>
                <Button size="small" type="primary" onClick={runPrompt} disabled={isRunning}>Run</Button>
                {isRunning && <Spin size="small" />}
              </div>
              {runError && (
                <Alert type="error" showIcon style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }} message={runError} />
              )}
              <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {runMessages.length === 0 && <div style={{ color: 'var(--muted)' }}>Press "Run" to get a response from the model.</div>}
                {runMessages.map((m, idx) => (
                  <div key={m.id || idx} style={{ textAlign: 'left' }}>
                    {m.role !== 'assistant' && <div style={{ fontWeight: 600 }}>{m.role}</div>}
                    {m.loading ? (
                      <div className="panel shimmer" style={{ height: 56, borderColor: 'var(--panel-border)' }} />
                    ) : (
                      m.content && (
                        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ''}</ReactMarkdown>
                        </Typography.Paragraph>
                      )
                    )}
                    {Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontWeight: 600 }}>Tool calls:</div>
                        <div className="col" style={{ gap: 6 }}>
                          {m.tool_calls.map((tc, i) => (
                            <div key={i} className="panel" style={{ borderStyle: 'dashed', borderColor: 'var(--panel-border)' }}>
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
                        <Button size="small" onClick={() => saveAssistantToPrompt(idx)} disabled={isRunning}>Add to prompt</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
          </Layout.Content>
        </Layout>
      </Layout>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
