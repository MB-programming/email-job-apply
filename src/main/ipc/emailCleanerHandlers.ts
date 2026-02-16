import { ipcMain } from 'electron'
import type Store from 'electron-store'
import type { EmailConfig } from '../services/emailService'
import {
  listFolders,
  createFolder,
  deleteFolder,
  renameFolder,
  fetchHeaders,
  deleteEmailsByUIDs,
  emptyFolder,
  moveEmailsByUIDs,
  markReadByUIDs,
  fetchSubscriptions,
  bulkUnsubscribe,
  type EmailFilter
} from '../services/emailCleanerService'

export function registerEmailCleanerHandlers(store: Store): void {
  // ── Account helpers ──────────────────────────────────────────────────────

  function getAccounts(): EmailConfig[] {
    return (store.get('emailAccounts') as EmailConfig[] | undefined) ?? []
  }

  function getConfig(idx: number): EmailConfig {
    const accounts = getAccounts()
    if (accounts[idx]) return accounts[idx]
    const legacy = store.get('emailConfig') as EmailConfig | undefined
    if (legacy) return legacy
    throw new Error('No email account configured.')
  }

  // ── Account management ───────────────────────────────────────────────────

  ipcMain.handle('cleaner:list-accounts', () => {
    const accounts = getAccounts()
    const legacy = store.get('emailConfig') as EmailConfig | undefined
    if (accounts.length === 0 && legacy) return [legacy]
    return accounts
  })

  ipcMain.handle('cleaner:save-account', (_, payload: { idx: number; config: EmailConfig }) => {
    const accounts = getAccounts()
    if (payload.idx === -1) {
      accounts.push(payload.config)
    } else {
      accounts[payload.idx] = payload.config
    }
    store.set('emailAccounts', accounts)
    // Keep legacy emailConfig in sync (primary account = index 0)
    if (payload.idx === 0 || payload.idx === -1) {
      store.set('emailConfig', accounts[0])
    }
    return { success: true }
  })

  ipcMain.handle('cleaner:delete-account', (_, idx: number) => {
    const accounts = getAccounts()
    accounts.splice(idx, 1)
    store.set('emailAccounts', accounts)
    if (accounts.length > 0) store.set('emailConfig', accounts[0])
    return { success: true }
  })

  ipcMain.handle('email:test-connection-idx', async (_, idx: number) => {
    const config = getConfig(idx)
    const { testConnection } = await import('../services/emailService')
    return testConnection(config)
  })

  // ── Folder operations ────────────────────────────────────────────────────

  ipcMain.handle('cleaner:list-folders', async (_, accountIdx: number) => {
    const config = getConfig(accountIdx)
    return listFolders(config)
  })

  ipcMain.handle(
    'cleaner:create-folder',
    async (_, payload: { accountIdx: number; path: string }) => {
      const config = getConfig(payload.accountIdx)
      await createFolder(config, payload.path)
      return { success: true }
    }
  )

  ipcMain.handle(
    'cleaner:delete-folder',
    async (_, payload: { accountIdx: number; path: string }) => {
      const config = getConfig(payload.accountIdx)
      await deleteFolder(config, payload.path)
      return { success: true }
    }
  )

  ipcMain.handle(
    'cleaner:rename-folder',
    async (_, payload: { accountIdx: number; oldPath: string; newPath: string }) => {
      const config = getConfig(payload.accountIdx)
      await renameFolder(config, payload.oldPath, payload.newPath)
      return { success: true }
    }
  )

  // ── Email header fetch ───────────────────────────────────────────────────

  ipcMain.handle(
    'cleaner:fetch-headers',
    async (_, payload: { accountIdx: number; folder: string; limit: number }) => {
      const config = getConfig(payload.accountIdx)
      return fetchHeaders(config, payload.folder, payload.limit)
    }
  )

  // ── Bulk email actions ───────────────────────────────────────────────────

  ipcMain.handle(
    'cleaner:delete-emails',
    async (_, payload: { accountIdx: number; folder: string; uids: number[] }) => {
      const config = getConfig(payload.accountIdx)
      await deleteEmailsByUIDs(config, payload.folder, payload.uids)
      return { success: true, count: payload.uids.length }
    }
  )

  ipcMain.handle(
    'cleaner:empty-folder',
    async (_, payload: { accountIdx: number; folder: string }) => {
      const config = getConfig(payload.accountIdx)
      const count = await emptyFolder(config, payload.folder)
      return { success: true, count }
    }
  )

  ipcMain.handle(
    'cleaner:move-emails',
    async (
      _,
      payload: { accountIdx: number; folder: string; destFolder: string; uids: number[] }
    ) => {
      const config = getConfig(payload.accountIdx)
      await moveEmailsByUIDs(config, payload.folder, payload.destFolder, payload.uids)
      return { success: true, count: payload.uids.length }
    }
  )

  ipcMain.handle(
    'cleaner:mark-read',
    async (_, payload: { accountIdx: number; folder: string; uids: number[] }) => {
      const config = getConfig(payload.accountIdx)
      await markReadByUIDs(config, payload.folder, payload.uids)
      return { success: true, count: payload.uids.length }
    }
  )

  // ── Subscriptions ────────────────────────────────────────────────────────

  ipcMain.handle(
    'cleaner:fetch-subscriptions',
    async (_, payload: { accountIdx: number; folder: string }) => {
      const config = getConfig(payload.accountIdx)
      return fetchSubscriptions(config, payload.folder, 300)
    }
  )

  ipcMain.handle(
    'cleaner:bulk-unsubscribe',
    async (event, payload: { accountIdx: number; items: unknown[] }) => {
      const config = getConfig(payload.accountIdx)
      const items = payload.items as Parameters<typeof bulkUnsubscribe>[1]
      return bulkUnsubscribe(config, items, (done, total, from) => {
        event.sender.send('cleaner:unsub-progress', { done, total, from })
      })
    }
  )

  // ── Filters (stored locally) ──────────────────────────────────────────────

  ipcMain.handle('cleaner:get-filters', () => {
    return (store.get('emailFilters') as EmailFilter[] | undefined) ?? []
  })

  ipcMain.handle('cleaner:save-filters', (_, filters: EmailFilter[]) => {
    store.set('emailFilters', filters)
    return { success: true }
  })
}
