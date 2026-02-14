import React, { useState, useEffect, useCallback } from 'react'
import { Send, RefreshCw, Mail, AlertCircle, ChevronRight, X } from 'lucide-react'
import type { EmailMessage } from '../types/electron.d'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function SentView(): React.ReactElement {
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<EmailMessage | null>(null)

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.email.fetchSent()
      setEmails(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  return (
    <div className="flex h-full">
      {/* Email list */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Send size={17} className="text-accent" />
            <h2 className="text-sm font-semibold text-white">Sent</h2>
            {emails.length > 0 && (
              <span className="text-xs bg-surface-300 text-white/70 px-2 py-0.5 rounded-full">
                {emails.length}
              </span>
            )}
          </div>
          <button
            onClick={fetchEmails}
            disabled={loading}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && emails.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
              <RefreshCw size={20} className="animate-spin" />
              <p className="text-sm">Loading sent emails...</p>
            </div>
          )}

          {error && (
            <div className="m-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex gap-2">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {!loading && !error && emails.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted">
              <Send size={24} />
              <p className="text-sm">No sent emails found</p>
            </div>
          )}

          {emails.map((email) => (
            <button
              key={email.id}
              onClick={() => setSelected(email)}
              className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-surface-100 transition-colors ${
                selected?.id === email.id ? 'bg-surface-100 border-l-2 border-l-accent' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <Send size={14} className="text-muted mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs text-white/70 truncate">To: {email.to}</p>
                    <span className="text-xs text-muted flex-shrink-0 ml-2">
                      {formatDate(email.date)}
                    </span>
                  </div>
                  <p className="text-xs text-white/80 truncate">{email.subject}</p>
                  <p className="text-xs text-muted truncate mt-0.5">{email.text?.slice(0, 60)}</p>
                </div>
                <ChevronRight size={13} className="text-muted flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Email detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="px-6 py-4 border-b border-border flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white mb-1">{selected.subject}</h3>
                <p className="text-sm text-muted">
                  <span className="text-white/70">To:</span> {selected.to}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {new Date(selected.date).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {selected.html ? (
                <div
                  className="prose prose-invert prose-sm max-w-none text-white/80"
                  dangerouslySetInnerHTML={{ __html: selected.html }}
                />
              ) : (
                <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                  {selected.text}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
            <Mail size={32} />
            <p className="text-sm">Select an email to view</p>
          </div>
        )}
      </div>
    </div>
  )
}
