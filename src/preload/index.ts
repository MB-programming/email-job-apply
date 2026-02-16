import { contextBridge, ipcRenderer } from 'electron'
import type { ChatMessage } from '../main/services/openaiService'
import type { EmailConfig, BulkSendItem, BulkSendResult } from '../main/services/emailService'

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
    sendBulk: (items: BulkSendItem[]): Promise<BulkSendResult[]> =>
      ipcRenderer.invoke('email:send-bulk', items),
    testConnection: () => ipcRenderer.invoke('email:test-connection'),
    pickAttachment: () => ipcRenderer.invoke('email:pick-attachment'),
    onBulkProgress: (
      callback: (p: { done: number; total: number; current: string }) => void
    ) => {
      ipcRenderer.on('email:bulk-progress', (_, p) => callback(p))
    },
    removeBulkProgressListeners: () => {
      ipcRenderer.removeAllListeners('email:bulk-progress')
    }
  },

  // AI operations
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
    getModels: () => ipcRenderer.invoke('openai:get-models'),
    getSelectedModel: (): Promise<string> => ipcRenderer.invoke('openai:get-selected-model'),
    setSelectedModel: (modelId: string) => ipcRenderer.invoke('openai:set-selected-model', modelId),
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
    getGeminiKey: (): Promise<string | null> => ipcRenderer.invoke('settings:get-gemini-key'),
    saveGeminiKey: (key: string) => ipcRenderer.invoke('settings:save-gemini-key', key),
    getGroqKey: (): Promise<string | null> => ipcRenderer.invoke('settings:get-groq-key'),
    saveGroqKey: (key: string) => ipcRenderer.invoke('settings:save-groq-key', key),
    getProfile: () => ipcRenderer.invoke('settings:get-profile'),
    saveProfile: (profile: Record<string, string>) =>
      ipcRenderer.invoke('settings:save-profile', profile)
  },

  // Export operations
  export: {
    cvPDF: (html: string) => ipcRenderer.invoke('export:cv-pdf', html),
    cvImage: (html: string) => ipcRenderer.invoke('export:cv-image', html),
    cvWord: (cv: unknown) => ipcRenderer.invoke('export:cv-word', cv),
    jobsExcel: (jobs: unknown[]) => ipcRenderer.invoke('export:jobs-excel', jobs),
    jobsWord: (jobs: unknown[]) => ipcRenderer.invoke('export:jobs-word', jobs)
  },

  // Job collector (visible browser)
  collector: {
    start: (params: { keyword: string; location: string; maxResults: number; sources: string[] }) =>
      ipcRenderer.invoke('collector:start', params),
    onJob: (callback: (job: unknown) => void) => {
      ipcRenderer.on('collector:job', (_, job) => callback(job))
    },
    onDone: (callback: (info: { total: number }) => void) => {
      ipcRenderer.on('collector:done', (_, info) => callback(info))
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners('collector:job')
      ipcRenderer.removeAllListeners('collector:done')
    }
  },

  // Scraping operations
  scraping: {
    search: (params: {
      keyword: string
      location: string
      maxResults: number
      sources: string[]
    }) => ipcRenderer.invoke('scraping:search', params),
    extractEmail: (url: string) => ipcRenderer.invoke('scraping:extract-email', url),
    onProgress: (callback: (p: { found: number; msg: string }) => void) => {
      ipcRenderer.on('scraping:progress', (_, p) => callback(p))
    },
    removeProgressListeners: () => {
      ipcRenderer.removeAllListeners('scraping:progress')
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
