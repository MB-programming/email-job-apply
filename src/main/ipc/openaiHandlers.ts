import { ipcMain } from 'electron'
import type Store from 'electron-store'
import { streamChat, generateJobEmail, AVAILABLE_MODELS } from '../services/openaiService'
import type { ChatMessage, ModelConfig } from '../services/openaiService'

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

export function registerOpenAIHandlers(store: Store): void {
  ipcMain.handle('openai:chat', async (event, messages: ChatMessage[]) => {
    const config = getModelConfig(store)
    let fullResponse = ''

    await streamChat(config, messages, (chunk) => {
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
