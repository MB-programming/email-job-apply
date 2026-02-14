export interface EmailMessage {
  id: string
  from: string
  to: string
  subject: string
  date: string
  text: string
  html?: string
  read: boolean
}

export interface EmailConfig {
  imapHost: string
  imapPort: number
  imapTLS: boolean
  smtpHost: string
  smtpPort: number
  smtpTLS: boolean
  user: string
  password: string
  fromName: string
}

export interface BulkSendItem {
  company: string
  to: string
  subject: string
  body: string
  attachments?: Array<{ filename: string; path: string }>
}

export interface BulkSendResult {
  company: string
  to: string
  success: boolean
  error?: string
}

declare global {
  interface Window {
    api: {
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
      email: {
        fetchInbox: () => Promise<EmailMessage[]>
        fetchSent: () => Promise<EmailMessage[]>
        send: (payload: {
          to: string | string[]
          subject: string
          body: string
          attachments?: Array<{ filename: string; path: string }>
        }) => Promise<{ success: boolean }>
        sendBulk: (items: BulkSendItem[]) => Promise<BulkSendResult[]>
        testConnection: () => Promise<{ imap: boolean; smtp: boolean; error?: string }>
        pickAttachment: () => Promise<{ path: string; filename: string } | null>
        onBulkProgress: (callback: (p: { done: number; total: number; current: string }) => void) => void
        removeBulkProgressListeners: () => void
      }
      openai: {
        chat: (messages: Array<{ role: string; content: string }>) => Promise<string>
        generateJobEmail: (params: {
          companyName: string
          jobTitle?: string
          language: 'de' | 'en'
          senderName: string
          senderSkills: string
          cvPath?: string
        }) => Promise<string>
        getModels: () => Promise<Array<{ id: string; name: string; provider: string; tier: string; description: string }>>
        getSelectedModel: () => Promise<string>
        setSelectedModel: (modelId: string) => Promise<{ success: boolean }>
        onStreamChunk: (callback: (chunk: { delta: string; done: boolean }) => void) => void
        removeStreamListeners: () => void
      }
      settings: {
        getEmailConfig: () => Promise<EmailConfig | null>
        saveEmailConfig: (config: EmailConfig) => Promise<{ success: boolean }>
        getOpenAIKey: () => Promise<string | null>
        saveOpenAIKey: (key: string) => Promise<{ success: boolean }>
        getGeminiKey: () => Promise<string | null>
        saveGeminiKey: (key: string) => Promise<{ success: boolean }>
        getGroqKey: () => Promise<string | null>
        saveGroqKey: (key: string) => Promise<{ success: boolean }>
        getProfile: () => Promise<Record<string, string>>
        saveProfile: (profile: Record<string, string>) => Promise<{ success: boolean }>
      }
      scraping: {
        search: (params: { keyword: string; location: string; maxResults: number; sources: string[] }) => Promise<Array<{ title: string; company: string; location: string; url: string; email?: string; source: string }>>
        extractEmail: (url: string) => Promise<string | null>
        onProgress: (callback: (p: { found: number; msg: string }) => void) => void
        removeProgressListeners: () => void
      }
    }
  }
}
