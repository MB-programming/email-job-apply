import { ipcMain, dialog } from 'electron'
import type Store from 'electron-store'
import { fetchEmails, sendEmail, sendBulkEmails, testConnection } from '../services/emailService'
import type { EmailConfig, BulkSendItem } from '../services/emailService'

export function registerEmailHandlers(store: Store): void {
  ipcMain.handle('email:fetch-inbox', async () => {
    const config = store.get('emailConfig') as EmailConfig | undefined
    if (!config) throw new Error('Email not configured. Go to Settings first.')
    return fetchEmails(config, 'INBOX', 50)
  })

  ipcMain.handle('email:fetch-sent', async () => {
    const config = store.get('emailConfig') as EmailConfig | undefined
    if (!config) throw new Error('Email not configured. Go to Settings first.')
    // Common sent folders
    const sentFolders = ['Sent', 'Sent Messages', 'INBOX.Sent', 'Sent Items', '[Gmail]/Sent Mail']
    for (const folder of sentFolders) {
      try {
        return await fetchEmails(config, folder, 50)
      } catch {
        continue
      }
    }
    throw new Error('Could not find Sent folder. Check your email provider settings.')
  })

  ipcMain.handle(
    'email:send',
    async (
      _,
      payload: {
        to: string | string[]
        subject: string
        body: string
        attachments?: Array<{ filename: string; path: string }>
      }
    ) => {
      const config = store.get('emailConfig') as EmailConfig | undefined
      if (!config) throw new Error('Email not configured.')
      await sendEmail(config, payload.to, payload.subject, payload.body, payload.attachments)
      return { success: true }
    }
  )

  ipcMain.handle('email:test-connection', async () => {
    const config = store.get('emailConfig') as EmailConfig | undefined
    if (!config) throw new Error('Email not configured.')
    return testConnection(config)
  })

  ipcMain.handle('email:send-bulk', async (event, items: BulkSendItem[]) => {
    const config = store.get('emailConfig') as EmailConfig | undefined
    if (!config) throw new Error('Email not configured.')

    const results = await sendBulkEmails(config, items, (done, total, current) => {
      event.sender.send('email:bulk-progress', { done, total, current })
    })

    return results
  })

  ipcMain.handle('email:pick-attachment', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select CV / Attachment',
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'file'
    return { path: filePath, filename: fileName }
  })
}
