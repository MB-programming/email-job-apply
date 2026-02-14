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

export interface ChatMessageType {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
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
        testConnection: () => Promise<{ imap: boolean; smtp: boolean; error?: string }>
        pickAttachment: () => Promise<{ path: string; filename: string } | null>
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
        onStreamChunk: (callback: (chunk: { delta: string; done: boolean }) => void) => void
        removeStreamListeners: () => void
      }
      settings: {
        getEmailConfig: () => Promise<EmailConfig | null>
        saveEmailConfig: (config: EmailConfig) => Promise<{ success: boolean }>
        getOpenAIKey: () => Promise<string | null>
        saveOpenAIKey: (key: string) => Promise<{ success: boolean }>
        getProfile: () => Promise<Record<string, string>>
        saveProfile: (profile: Record<string, string>) => Promise<{ success: boolean }>
      }
    }
  }
}
