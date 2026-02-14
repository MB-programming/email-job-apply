import { contextBridge, ipcRenderer } from 'electron'
import type { ChatMessage } from '../main/services/openaiService'
import type { EmailConfig } from '../main/services/emailService'

const api = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  },

  // Email operations
  email: {
    fetchInbox: () => ipcRenderer.invoke('email:fetch-inbox'),
    fetchSent: () => ipcRenderer.invoke('email:fetch-sent'),
    send: (payload: {
      to: string | string[]
      subject: string
      body: string
      attachments?: Array<{ filename: string; path: string }>
    }) => ipcRenderer.invoke('email:send', payload),
    testConnection: () => ipcRenderer.invoke('email:test-connection'),
    pickAttachment: () => ipcRenderer.invoke('email:pick-attachment')
  },

  // OpenAI operations
  openai: {
    chat: (messages: ChatMessage[]) => ipcRenderer.invoke('openai:chat', messages),
    generateJobEmail: (params: {
      companyName: string
      jobTitle?: string
      language: 'de' | 'en'
      senderName: string
      senderSkills: string
      cvPath?: string
    }) => ipcRenderer.invoke('openai:generate-job-email', params),
    onStreamChunk: (callback: (chunk: { delta: string; done: boolean }) => void) => {
      ipcRenderer.on('openai:stream-chunk', (_, chunk) => callback(chunk))
    },
    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('openai:stream-chunk')
    }
  },

  // Settings operations
  settings: {
    getEmailConfig: (): Promise<EmailConfig | null> =>
      ipcRenderer.invoke('settings:get-email-config'),
    saveEmailConfig: (config: EmailConfig) =>
      ipcRenderer.invoke('settings:save-email-config', config),
    getOpenAIKey: (): Promise<string | null> => ipcRenderer.invoke('settings:get-openai-key'),
    saveOpenAIKey: (key: string) => ipcRenderer.invoke('settings:save-openai-key', key),
    getProfile: () => ipcRenderer.invoke('settings:get-profile'),
    saveProfile: (profile: Record<string, string>) =>
      ipcRenderer.invoke('settings:save-profile', profile)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
