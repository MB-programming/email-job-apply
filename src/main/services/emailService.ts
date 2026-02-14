import Imap from 'imap'
import { simpleParser, ParsedMail } from 'mailparser'
import nodemailer from 'nodemailer'
import { Readable } from 'stream'

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

export async function fetchEmails(
  config: EmailConfig,
  folder: string = 'INBOX',
  limit: number = 50
): Promise<EmailMessage[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.imapHost,
      port: config.imapPort,
      tls: config.imapTLS,
      tlsOptions: { rejectUnauthorized: false }
    })

    const messages: EmailMessage[] = []

    imap.once('ready', () => {
      imap.openBox(folder, true, (err, box) => {
        if (err) {
          imap.end()
          return reject(err)
        }

        const total = box.messages.total
        if (total === 0) {
          imap.end()
          return resolve([])
        }

        const start = Math.max(1, total - limit + 1)
        const fetchRange = `${start}:${total}`

        const fetch = imap.seq.fetch(fetchRange, {
          bodies: '',
          struct: true
        })

        fetch.on('message', (msg, seqno) => {
          const chunks: Buffer[] = []
          let attrs: { flags: string[] } = { flags: [] }

          msg.on('body', (stream: Readable) => {
            stream.on('data', (chunk: Buffer) => chunks.push(chunk))
          })

          msg.once('attributes', (a) => {
            attrs = a
          })

          msg.once('end', () => {
            const buffer = Buffer.concat(chunks)
            simpleParser(buffer, (parseErr, parsed: ParsedMail) => {
              if (parseErr) return

              const fromAddress = parsed.from?.value[0]
              messages.push({
                id: String(seqno),
                from: fromAddress
                  ? `${fromAddress.name || ''} <${fromAddress.address || ''}>`.trim()
                  : 'Unknown',
                to: parsed.to
                  ? Array.isArray(parsed.to)
                    ? parsed.to[0].text
                    : parsed.to.text
                  : '',
                subject: parsed.subject || '(No Subject)',
                date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
                text: parsed.text || '',
                html: parsed.html || undefined,
                read: attrs.flags.includes('\\Seen')
              })
            })
          })
        })

        fetch.once('error', (fetchErr) => reject(fetchErr))
        fetch.once('end', () => {
          imap.end()
          setTimeout(() => resolve(messages.reverse()), 500)
        })
      })
    })

    imap.once('error', (err) => reject(err))
    imap.connect()
  })
}

export async function sendEmail(
  config: EmailConfig,
  to: string | string[],
  subject: string,
  body: string,
  attachments?: Array<{ filename: string; path: string }>
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpTLS,
    auth: {
      user: config.user,
      pass: config.password
    },
    tls: { rejectUnauthorized: false }
  })

  const toAddresses = Array.isArray(to) ? to.join(', ') : to

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.user}>`,
    to: toAddresses,
    subject,
    html: body,
    attachments: attachments?.map((att) => ({
      filename: att.filename,
      path: att.path
    }))
  })
}

export async function testConnection(config: EmailConfig): Promise<{ imap: boolean; smtp: boolean; error?: string }> {
  const result = { imap: false, smtp: false, error: undefined as string | undefined }

  // Test IMAP
  await new Promise<void>((resolve) => {
    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.imapHost,
      port: config.imapPort,
      tls: config.imapTLS,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10000
    })
    imap.once('ready', () => {
      result.imap = true
      imap.end()
      resolve()
    })
    imap.once('error', (err) => {
      result.error = `IMAP: ${err.message}`
      resolve()
    })
    imap.connect()
  })

  // Test SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpTLS,
      auth: { user: config.user, pass: config.password },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000
    })
    await transporter.verify()
    result.smtp = true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    result.error = result.error ? `${result.error} | SMTP: ${msg}` : `SMTP: ${msg}`
  }

  return result
}
