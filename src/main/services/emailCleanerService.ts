import Imap from 'imap'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import { Readable } from 'stream'
import type { EmailConfig } from './emailService'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FolderInfo {
  name: string
  path: string
  messages: number
  unseen: number
}

export interface EmailHeader {
  uid: number
  from: string
  fromEmail: string
  subject: string
  date: string
  size: number
  flags: string[]
  unsubscribeUrl?: string
  unsubscribeMail?: string
}

export interface UnsubscribeResult {
  uid: number
  fromEmail: string
  success: boolean
  method: 'http' | 'mail' | 'none'
  error?: string
}

// ─── IMAP helpers ────────────────────────────────────────────────────────────

function makeImap(config: EmailConfig): Imap {
  return new Imap({
    user: config.user,
    password: config.password,
    host: config.imapHost,
    port: config.imapPort,
    tls: config.imapTLS,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 15000,
    authTimeout: 10000
  })
}

async function withImap<T>(config: EmailConfig, fn: (imap: Imap) => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const imap = makeImap(config)
    imap.once('ready', () => {
      fn(imap).then(resolve).catch(reject).finally(() => {
        try { imap.end() } catch { /* ignore */ }
      })
    })
    imap.once('error', reject)
    imap.connect()
  })
}

// ─── Folder operations ───────────────────────────────────────────────────────

export async function listFolders(config: EmailConfig): Promise<FolderInfo[]> {
  return withImap(config, (imap) =>
    new Promise((resolve, reject) => {
      imap.getBoxes('', (err, boxes) => {
        if (err) return reject(err)

        const folders: FolderInfo[] = []
        const flatten = (tree: Imap.MailBoxes, prefix = '') => {
          for (const [name, box] of Object.entries(tree)) {
            const path = prefix ? `${prefix}${box.delimiter || '/'}${name}` : name
            folders.push({ name, path, messages: 0, unseen: 0 })
            if (box.children) flatten(box.children, path)
          }
        }
        flatten(boxes)

        // Fetch message counts in parallel (best effort)
        const fetchCount = (f: FolderInfo): Promise<void> =>
          new Promise((res) => {
            imap.status(f.path, (e, box) => {
              if (!e && box) {
                f.messages = box.messages.total ?? 0
                f.unseen = box.messages.unseen ?? 0
              }
              res()
            })
          })

        Promise.all(folders.map(fetchCount)).then(() => resolve(folders)).catch(() => resolve(folders))
      })
    })
  )
}

export async function createFolder(config: EmailConfig, path: string): Promise<void> {
  return withImap(config, (imap) =>
    new Promise((resolve, reject) => {
      imap.addBox(path, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  )
}

export async function deleteFolder(config: EmailConfig, path: string): Promise<void> {
  return withImap(config, (imap) =>
    new Promise((resolve, reject) => {
      imap.delBox(path, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  )
}

export async function renameFolder(
  config: EmailConfig,
  oldPath: string,
  newPath: string
): Promise<void> {
  return withImap(config, (imap) =>
    new Promise((resolve, reject) => {
      imap.renameBox(oldPath, newPath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  )
}

// ─── Email header fetch ───────────────────────────────────────────────────────

export async function fetchHeaders(
  config: EmailConfig,
  folder: string,
  limit = 100
): Promise<EmailHeader[]> {
  return withImap(config, (imap) =>
    new Promise((resolve, reject) => {
      imap.openBox(folder, true, (err, box) => {
        if (err) return reject(err)

        const total = box.messages.total
        if (total === 0) return resolve([])

        const start = Math.max(1, total - limit + 1)

        const fetch = imap.seq.fetch(`${start}:${total}`, {
          bodies: 'HEADER.FIELDS (FROM SUBJECT DATE LIST-UNSUBSCRIBE)',
          struct: false,
          size: true
        })

        const headers: EmailHeader[] = []

        fetch.on('message', (msg, seqno) => {
          const chunks: Buffer[] = []
          let uid = seqno
          let size = 0
          let flags: string[] = []

          msg.on('body', (stream: Readable) => {
            stream.on('data', (c: Buffer) => chunks.push(c))
          })

          msg.once('attributes', (attrs) => {
            uid = attrs.uid ?? seqno
            size = (attrs as { size?: number }).size ?? 0
            flags = attrs.flags ?? []
          })

          msg.once('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8')
            // Parse key headers manually (faster than simpleParser for headers)
            const get = (name: string): string => {
              const re = new RegExp(`^${name}:\\s*(.+?)\\s*$`, 'im')
              return raw.match(re)?.[1]?.trim() ?? ''
            }

            const fromRaw = get('From')
            const emailMatch = fromRaw.match(/<([^>]+)>/) ?? fromRaw.match(/([^\s]+@[^\s]+)/)
            const fromEmail = emailMatch?.[1]?.toLowerCase() ?? fromRaw

            const unsubRaw = get('List-Unsubscribe')
            let unsubscribeUrl: string | undefined
            let unsubscribeMail: string | undefined

            if (unsubRaw) {
              const urlMatch = unsubRaw.match(/<(https?:\/\/[^>]+)>/)
              const mailMatch = unsubRaw.match(/<mailto:([^>]+)>/)
              if (urlMatch) unsubscribeUrl = urlMatch[1]
              if (mailMatch) unsubscribeMail = mailMatch[1]
            }

            headers.push({
              uid,
              from: fromRaw,
              fromEmail,
              subject: get('Subject'),
              date: get('Date'),
              size,
              flags,
              unsubscribeUrl,
              unsubscribeMail
            })
          })
        })

        fetch.once('error', reject)
        fetch.once('end', () => setTimeout(() => resolve(headers.reverse()), 300))
      })
    })
  )
}

// ─── Bulk delete ─────────────────────────────────────────────────────────────

export async function deleteEmailsByUIDs(
  config: EmailConfig,
  folder: string,
  uids: number[]
): Promise<void> {
  if (uids.length === 0) return

  return withImap(config, (imap) =>
    new Promise((resolve, reject) => {
      imap.openBox(folder, false, (err) => {
        if (err) return reject(err)

        const uidStr = uids.join(',')
        imap.addFlags(uidStr, ['\\Deleted'], (flagErr) => {
          if (flagErr) return reject(flagErr)
          imap.expunge((expErr) => {
            if (expErr) return reject(expErr)
            resolve()
          })
        })
      })
    })
  )
}

export async function emptyFolder(config: EmailConfig, folder: string): Promise<number> {
  return withImap(config, (imap) =>
    new Promise((resolve, reject) => {
      imap.openBox(folder, false, (err, box) => {
        if (err) return reject(err)
        const total = box.messages.total
        if (total === 0) return resolve(0)

        imap.seq.addFlags('1:*', ['\\Deleted'], (flagErr) => {
          if (flagErr) return reject(flagErr)
          imap.expunge((expErr) => {
            if (expErr) return reject(expErr)
            resolve(total)
          })
        })
      })
    })
  )
}

// ─── Move emails ──────────────────────────────────────────────────────────────

export async function moveEmailsByUIDs(
  config: EmailConfig,
  folder: string,
  destFolder: string,
  uids: number[]
): Promise<void> {
  if (uids.length === 0) return

  return withImap(config, (imap) =>
    new Promise((resolve, reject) => {
      imap.openBox(folder, false, (err) => {
        if (err) return reject(err)

        const uidStr = uids.join(',')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imapAny = imap as any
        imapAny.uid.copy(uidStr, destFolder, (copyErr: Error | null) => {
          if (copyErr) return reject(copyErr)
          imapAny.uid.addFlags(uidStr, ['\\Deleted'], (flagErr: Error | null) => {
            if (flagErr) return reject(flagErr)
            imap.expunge((expErr) => {
              if (expErr) return reject(expErr)
              resolve()
            })
          })
        })
      })
    })
  )
}

// ─── Mark as read ────────────────────────────────────────────────────────────

export async function markReadByUIDs(
  config: EmailConfig,
  folder: string,
  uids: number[]
): Promise<void> {
  if (uids.length === 0) return

  return withImap(config, (imap) =>
    new Promise((resolve, reject) => {
      imap.openBox(folder, false, (err) => {
        if (err) return reject(err)
        const uidStr = uids.join(',')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(imap as any).uid.addFlags(uidStr, ['\\Seen'], (flagErr: Error | null) => {
          if (flagErr) return reject(flagErr)
          resolve()
        })
      })
    })
  )
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function fetchSubscriptions(
  config: EmailConfig,
  folder = 'INBOX',
  limit = 200
): Promise<EmailHeader[]> {
  const all = await fetchHeaders(config, folder, limit)
  return all.filter((h) => h.unsubscribeUrl || h.unsubscribeMail)
}

export async function unsubscribeViaHTTP(url: string): Promise<void> {
  const { net } = await import('electron')
  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'GET', url })
    req.on('response', () => resolve())
    req.on('error', reject)
    req.end()
  })
}

export async function unsubscribeViaMail(
  config: EmailConfig,
  to: string,
  subject = 'Unsubscribe'
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpTLS,
    auth: { user: config.user, pass: config.password },
    tls: { rejectUnauthorized: false }
  })
  await transporter.sendMail({
    from: config.user,
    to,
    subject
  })
}

export async function bulkUnsubscribe(
  config: EmailConfig,
  items: EmailHeader[],
  onProgress: (done: number, total: number, from: string) => void
): Promise<UnsubscribeResult[]> {
  const results: UnsubscribeResult[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    onProgress(i, items.length, item.fromEmail)

    if (item.unsubscribeUrl) {
      try {
        await unsubscribeViaHTTP(item.unsubscribeUrl)
        results.push({ uid: item.uid, fromEmail: item.fromEmail, success: true, method: 'http' })
      } catch (e) {
        results.push({ uid: item.uid, fromEmail: item.fromEmail, success: false, method: 'http', error: String(e) })
      }
    } else if (item.unsubscribeMail) {
      try {
        const [to, rawSubject] = item.unsubscribeMail.split('?subject=')
        await unsubscribeViaMail(config, to, rawSubject ? decodeURIComponent(rawSubject) : 'Unsubscribe')
        results.push({ uid: item.uid, fromEmail: item.fromEmail, success: true, method: 'mail' })
      } catch (e) {
        results.push({ uid: item.uid, fromEmail: item.fromEmail, success: false, method: 'mail', error: String(e) })
      }
    } else {
      results.push({ uid: item.uid, fromEmail: item.fromEmail, success: false, method: 'none' })
    }

    await new Promise((r) => setTimeout(r, 200))
  }

  onProgress(items.length, items.length, '')
  return results
}

// ─── Local filters ────────────────────────────────────────────────────────────

export interface EmailFilter {
  id: string
  name: string
  field: 'from' | 'subject' | 'to'
  op: 'contains' | 'equals' | 'startsWith' | 'endsWith'
  value: string
  action: 'delete' | 'move' | 'markRead'
  targetFolder?: string
}

export function applyFilters(headers: EmailHeader[], filters: EmailFilter[]): Map<string, number[]> {
  const matched = new Map<string, number[]>()

  for (const header of headers) {
    for (const filter of filters) {
      const haystack = (filter.field === 'from' ? header.from : header.subject).toLowerCase()
      const needle = filter.value.toLowerCase()

      let match = false
      if (filter.op === 'contains') match = haystack.includes(needle)
      else if (filter.op === 'equals') match = haystack === needle
      else if (filter.op === 'startsWith') match = haystack.startsWith(needle)
      else if (filter.op === 'endsWith') match = haystack.endsWith(needle)

      if (match) {
        const key = filter.action + (filter.targetFolder ? ':' + filter.targetFolder : '')
        if (!matched.has(key)) matched.set(key, [])
        matched.get(key)!.push(header.uid)
      }
    }
  }

  return matched
}
