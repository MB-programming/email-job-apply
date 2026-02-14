import React, { useState } from 'react'
import { X, Send, Paperclip, Loader2, Sparkles, AlertCircle, CheckCircle } from 'lucide-react'

interface ComposeModalProps {
  onClose: () => void
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
}

export default function ComposeModal({
  onClose,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = ''
}: ComposeModalProps): React.ReactElement {
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)
  const [attachments, setAttachments] = useState<Array<{ filename: string; path: string }>>([])
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return
    setSending(true)
    setMsg(null)
    try {
      await window.api.email.send({ to, subject, body, attachments })
      setMsg({ type: 'success', text: 'Email sent successfully!' })
      setTimeout(onClose, 1500)
    } catch (err: unknown) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setSending(false)
    }
  }

  const handleAttach = async () => {
    const file = await window.api.email.pickAttachment()
    if (file) setAttachments((prev) => [...prev, file])
  }

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  const generateWithAI = async () => {
    if (!to.trim()) {
      setMsg({ type: 'error', text: 'Enter a recipient first so AI knows who to write to.' })
      return
    }
    setGenerating(true)
    setMsg(null)
    try {
      const profile = await window.api.settings.getProfile()
      const companyName = to.split('@')[1]?.split('.')[0] || to
      const result = await window.api.openai.generateJobEmail({
        companyName,
        language: 'de',
        senderName: profile.name || 'Applicant',
        senderSkills: profile.skills || 'Software Development',
        cvPath: profile.cvPath
      })

      // Extract subject and body from AI response
      const lines = result.split('\n')
      let subjectLine = ''
      let bodyStart = 0
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().startsWith('betreff:') || lines[i].toLowerCase().startsWith('subject:')) {
          subjectLine = lines[i].replace(/^(betreff|subject):\s*/i, '').trim()
          bodyStart = i + 1
          break
        }
      }
      if (subjectLine) setSubject(subjectLine)
      setBody(lines.slice(bodyStart).join('\n').trim())
    } catch (err: unknown) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-50 border border-border rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-white">New Email</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {msg && (
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
                msg.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}
            >
              {msg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              {msg.text}
            </div>
          )}

          <div>
            <label className="block text-xs text-muted mb-1.5">To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@company.com or multiple, separated by commas"
              className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-muted">Body</label>
              <button
                onClick={generateWithAI}
                disabled={generating}
                className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-light transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                {generating ? 'Generating...' : 'Generate with AI (German)'}
              </button>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email or use AI to generate one..."
              rows={12}
              className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-100 rounded-lg"
                >
                  <Paperclip size={13} className="text-accent" />
                  <span className="text-xs text-white/80 flex-1 truncate">{att.filename}</span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="text-muted hover:text-white text-sm"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={handleAttach}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted hover:text-white hover:bg-surface-200 transition-colors"
          >
            <Paperclip size={15} />
            Attach File
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-muted hover:text-white hover:bg-surface-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent hover:bg-accent-light text-sm text-white font-medium disabled:opacity-50 transition-colors"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
