import { ipcMain } from 'electron'
import type Store from 'electron-store'
import type { EmailConfig } from '../services/emailService'

export function registerSettingsHandlers(store: Store): void {
  ipcMain.handle('settings:get-email-config', () => {
    const config = store.get('emailConfig') as EmailConfig | undefined
    // Mask password for security
    if (config) {
      return { ...config, password: config.password ? '••••••••' : '' }
    }
    return null
  })

  ipcMain.handle('settings:save-email-config', (_, config: EmailConfig) => {
    // If password is masked, keep the existing one
    const existing = store.get('emailConfig') as EmailConfig | undefined
    if (config.password === '••••••••' && existing) {
      config.password = existing.password
    }
    store.set('emailConfig', config)
    return { success: true }
  })

  // Generic masked key helpers
  function getMaskedKey(storeKey: string): string | null {
    const key = store.get(storeKey) as string | undefined
    return key ? '••••••••••••••••' + key.slice(-4) : null
  }

  function saveKey(storeKey: string, value: string): void {
    if (!value.startsWith('••')) store.set(storeKey, value)
  }

  ipcMain.handle('settings:get-openai-key', () => getMaskedKey('openaiApiKey'))
  ipcMain.handle('settings:save-openai-key', (_, key: string) => {
    saveKey('openaiApiKey', key)
    return { success: true }
  })

  ipcMain.handle('settings:get-gemini-key', () => getMaskedKey('geminiApiKey'))
  ipcMain.handle('settings:save-gemini-key', (_, key: string) => {
    saveKey('geminiApiKey', key)
    return { success: true }
  })

  ipcMain.handle('settings:get-groq-key', () => getMaskedKey('groqApiKey'))
  ipcMain.handle('settings:save-groq-key', (_, key: string) => {
    saveKey('groqApiKey', key)
    return { success: true }
  })

  ipcMain.handle('settings:get-profile', () => {
    return store.get('userProfile') || {}
  })

  ipcMain.handle('settings:save-profile', (_, profile: Record<string, string>) => {
    store.set('userProfile', profile)
    return { success: true }
  })
}
