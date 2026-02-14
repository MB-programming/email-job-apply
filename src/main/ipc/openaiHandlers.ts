import { ipcMain, BrowserWindow } from 'electron'
import type Store from 'electron-store'
import { streamChat, generateJobEmail } from '../services/openaiService'
import type { ChatMessage } from '../services/openaiService'

export function registerOpenAIHandlers(store: Store): void {
  ipcMain.handle('openai:chat', async (event, messages: ChatMessage[]) => {
    const apiKey = store.get('openaiApiKey') as string | undefined
    if (!apiKey) throw new Error('OpenAI API key not configured. Go to Settings.')

    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) throw new Error('No window found')

    let fullResponse = ''

    await streamChat(apiKey, messages, (chunk) => {
      fullResponse += chunk.delta
      // Send each token chunk to the renderer
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
      const apiKey = store.get('openaiApiKey') as string | undefined
      if (!apiKey) throw new Error('OpenAI API key not configured.')
      return generateJobEmail(apiKey, params)
    }
  )
}
