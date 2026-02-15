import { ipcMain } from 'electron'
import type Store from 'electron-store'
import { streamChat, generateJobEmail, AVAILABLE_MODELS } from '../services/openaiService'
import type { ChatMessage, ModelConfig } from '../services/openaiService'
import { searchWeb } from '../services/webSearchService'

function getModelConfig(store: Store): ModelConfig {
  const selectedModelId = (store.get('selectedModel') as string) || 'gemini-2.0-flash'
  const modelDef = AVAILABLE_MODELS.find((m) => m.id === selectedModelId) || AVAILABLE_MODELS[0]

  let apiKey = ''
  if (modelDef.provider === 'openai') {
    apiKey = (store.get('openaiApiKey') as string) || ''
    if (!apiKey) throw new Error('OpenAI API key not configured. Go to Settings → AI Model.')
  } else if (modelDef.provider === 'gemini') {
    apiKey = (store.get('geminiApiKey') as string) || ''
    if (!apiKey) throw new Error('Google Gemini API key not configured. Go to Settings → AI Model.')
  } else if (modelDef.provider === 'groq') {
    apiKey = (store.get('groqApiKey') as string) || ''
    if (!apiKey) throw new Error('Groq API key not configured. Go to Settings → AI Model.')
  }

  return { provider: modelDef.provider, model: modelDef.id, apiKey }
}

// Detect if the user is asking to find companies or research the market
function isCompanyResearchRequest(messages: ChatMessage[]): boolean {
  const lastMsg = messages[messages.length - 1]
  if (!lastMsg || lastMsg.role !== 'user') return false
  const text = lastMsg.content.toLowerCase()
  return (
    /(find|search|list|give me|show|get|bring|هات|دور|ابحث|أعطيني|اجمع|اجيبلي|جيبلي|هاتلي|اعطيني).*(compan|firm|unternehm|شركة|شركات)/i.test(text) ||
    /(\d+)\s*(companies|firms|شركات|شركة)/i.test(text) ||
    /(programming|software|tech|IT|development|برمجة|تقنية|تطوير).*(austria|wien|graz|österreich|نمسا|فيينا)/i.test(text) ||
    /(austria|wien|graz|österreich|نمسا|فيينا).*(programming|software|tech|IT|برمجة|تقنية)/i.test(text)
  )
}

// Build search queries based on user message
function buildSearchQueries(messages: ChatMessage[]): string[] {
  const lastMsg = messages[messages.length - 1].content.toLowerCase()

  // Extract location hints
  let location = 'Vienna Austria'
  if (/wien|vienna|فيينا/.test(lastMsg)) location = 'Vienna Austria'
  else if (/graz/.test(lastMsg)) location = 'Graz Austria'
  else if (/linz/.test(lastMsg)) location = 'Linz Austria'
  else if (/salzburg/.test(lastMsg)) location = 'Salzburg Austria'
  else if (/innsbruck/.test(lastMsg)) location = 'Innsbruck Austria'
  else if (/austri|österreich|نمسا/.test(lastMsg)) location = 'Austria'

  // Extract specialization
  let spec = 'software development'
  if (/react|frontend|front.end/.test(lastMsg)) spec = 'React frontend development'
  else if (/backend|back.end/.test(lastMsg)) spec = 'backend software development'
  else if (/fullstack|full.stack/.test(lastMsg)) spec = 'fullstack development'
  else if (/mobile|android|ios/.test(lastMsg)) spec = 'mobile app development'
  else if (/devops|cloud/.test(lastMsg)) spec = 'DevOps cloud'
  else if (/java\b/.test(lastMsg)) spec = 'Java software development'
  else if (/python/.test(lastMsg)) spec = 'Python development'
  else if (/\.net|dotnet/.test(lastMsg)) spec = '.NET development'

  return [
    `small medium ${spec} company ${location} jobs email Bewerbung`,
    `Softwareunternehmen ${location} Stellenangebote Bewerbung email`,
    `${spec} startup ${location} hiring 2024 2025`,
    `IT Unternehmen ${location} kleine mittelgroße Firma Kontakt`
  ]
}

// Format search results as AI context
function formatSearchContext(results: { title: string; url: string; snippet: string }[]): string {
  if (!results.length) return ''

  const items = results
    .slice(0, 8)
    .map((r, i) => `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.snippet}`)
    .join('\n\n')

  return `\n\n---\n**LIVE WEB SEARCH RESULTS** (use ONLY these companies, not famous ones from your training data):\n\n${items}\n\n---\n`
}

export function registerOpenAIHandlers(store: Store): void {
  ipcMain.handle('openai:chat', async (event, messages: ChatMessage[]) => {
    const config = getModelConfig(store)
    let fullResponse = ''

    // Inject web search results if this is a company research request
    let augmentedMessages = messages
    if (isCompanyResearchRequest(messages)) {
      try {
        const queries = buildSearchQueries(messages)
        const allResults: { title: string; url: string; snippet: string }[] = []
        const seen = new Set<string>()

        for (const q of queries.slice(0, 2)) {
          const r = await searchWeb(q, 5)
          for (const item of r) {
            const key = item.url.split('/').slice(0, 3).join('/')
            if (!seen.has(key)) {
              seen.add(key)
              allResults.push(item)
            }
          }
        }

        if (allResults.length > 0) {
          const context = formatSearchContext(allResults)
          // Inject search results into the last user message
          augmentedMessages = messages.map((m, i) => {
            if (i === messages.length - 1 && m.role === 'user') {
              return { ...m, content: m.content + context }
            }
            return m
          })
        }
      } catch (err) {
        console.error('Web search injection error:', err)
        // Continue without search context
      }
    }

    await streamChat(config, augmentedMessages, (chunk) => {
      fullResponse += chunk.delta
      event.sender.send('openai:stream-chunk', chunk)
    })

    return fullResponse
  })

  ipcMain.handle(
    'openai:generate-job-email',
    async (
      _,
      params: {
        companyName: string
        jobTitle?: string
        language: 'de' | 'en'
        senderName: string
        senderSkills: string
        cvPath?: string
      }
    ) => {
      const config = getModelConfig(store)
      return generateJobEmail(config, params)
    }
  )

  ipcMain.handle('openai:get-models', () => {
    return AVAILABLE_MODELS
  })

  ipcMain.handle('openai:get-selected-model', () => {
    return (store.get('selectedModel') as string) || 'gemini-2.0-flash'
  })

  ipcMain.handle('openai:set-selected-model', (_, modelId: string) => {
    store.set('selectedModel', modelId)
    return { success: true }
  })
}
