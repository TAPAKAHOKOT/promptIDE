export function mapToolsForOpenAI(prompt) {
  if (!prompt) return undefined
  const tools = (prompt.tools || []).filter((tool) => tool && tool.name && tool.enabled !== false)
  if (!tools.length) return undefined
  const mapped = []
  for (const tool of tools) {
    let schema = {}
    try {
      schema = tool.parameters ? JSON.parse(tool.parameters) : {}
    } catch {
      schema = {}
    }
    mapped.push({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: schema,
      },
    })
  }
  return mapped
}

export async function callOpenAI({ apiKey, model = 'gpt-4o-mini', messages = [], tools, fetchImpl = fetch }) {
  if (!apiKey) {
    return { assistant: null, error: 'Enter OpenAI API Key in the sidebar', usage: null, model: model || '' }
  }

  try {
    const payload = {
      model: model || 'gpt-4o-mini',
      messages: messages
        .filter((message) => message.role !== 'comment')
        .filter((message) => message.enabled !== false)
        .map((message) => ({ role: message.role, content: message.content })),
    }

    if (tools) {
      payload.tools = tools
      payload.tool_choice = 'auto'
    }

    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
    if (!msg) throw new Error('Empty response from model')

    return {
      assistant: {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: msg.content || '',
        tool_calls: msg.tool_calls || [],
      },
      error: '',
      usage: data.usage || null,
      model: data.model || model || '',
    }
  } catch (error) {
    const hint = 'Note: the key is unsafe on the frontend, and CORS may block requests. Use a proxy/backend if you have problems.'
    return { assistant: null, error: `${error.message}\n${hint}`, usage: null, model: model || '' }
  }
}

export default {
  mapToolsForOpenAI,
  callOpenAI,
}
