import React, { useState, useEffect } from 'react'
import {
  X,
  Send,
  CheckSquare,
  Square,
  Building2,
  Mail,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react'
import { useLang } from '../contexts/LanguageContext'

export interface BulkEmailItem {
  company: string
  to: string
  subject: string
  body: string
}

interface BulkResult {
  company: string
  to: string
  success: boolean
  error?: string
}

interface Props {
  items: BulkEmailItem[]
  onClose: () => void
  attachments?: Array<{ filename: string; path: string }>
}

type Phase = 'review' | 'sending' | 'done'

export default function BulkApprovalModal({ items, onClose, attachments }: Props): React.ReactElement {
  const { t, isRTL } = useLang()
  const [checked, setChecked] = useState<Set<number>>(new Set(items.map((_, i) => i)))
  const [expanded, setExpanded] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('review')
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' })
  const [results, setResults] = useState<BulkResult[]>([])

  useEffect(() => {
    window.api.email.onBulkProgress((p) => {
      setProgress(p)
    })
    return () => {
      window.api.email.removeBulkProgressListeners()
    }
  }, [])

  const toggleAll = () => {
    if (checked.size === items.length) {
      setChecked(new Set())
    } else {
      setChecked(new Set(items.map((_, i) => i)))
    }
  }

  const toggle = (i: number) => {
    const next = new Set(checked)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setChecked(next)
  }

  const handleSend = async () => {
    const selectedItems = items
      .filter((_, i) => checked.has(i))
      .map((item) => ({ ...item, attachments }))

    setProgress({ done: 0, total: selectedItems.length, current: '' })
    setPhase('sending')

    try {
      const res = await window.api.email.sendBulk(selectedItems)
      setResults(res)
      setPhase('done')
    } catch (err: unknown) {
      setResults(
        selectedItems.map((item) => ({
          company: item.company,
          to: item.to,
          success: false,
          error: err instanceof Error ? err.message : String(err)
        }))
      )
      setPhase('done')
    } finally {
      window.api.email.removeBulkProgressListeners()
    }
  }

  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-surface-50 border border-border rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl"
        style={{ maxHeight: '88vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">{t('bulkApprovalTitle')}</h2>
            <p className="text-xs text-muted mt-0.5">
              {checked.size} / {items.length} {t('emailsReady')}
            </p>
          </div>
          {phase !== 'sending' && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-200 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Review phase */}
          {phase === 'review' && (
            <div className="p-4 space-y-2">
              <p className="text-xs text-muted px-2 pb-2">{t('bulkApprovalDesc')}</p>

              {/* Select all toggle */}
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:text-white transition-colors"
              >
                {checked.size === items.length ? (
                  <CheckSquare size={14} className="text-accent" />
                ) : (
                  <Square size={14} />
                )}
                {checked.size === items.length ? t('deselectAll') : t('selectAll')}
              </button>

              {items.map((item, i) => (
                <div
                  key={i}
                  className={`rounded-xl border transition-colors ${
                    checked.has(i) ? 'border-accent/40 bg-surface-100' : 'border-border bg-surface-50'
                  }`}
                >
                  {/* Row header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => toggle(i)} className="flex-shrink-0">
                      {checked.has(i) ? (
                        <CheckSquare size={16} className="text-accent" />
                      ) : (
                        <Square size={16} className="text-muted" />
                      )}
                    </button>

                    {/* Number badge */}
                    <div className="w-6 h-6 rounded-full bg-surface-300 flex items-center justify-center text-xs font-bold text-white/60 flex-shrink-0">
                      {i + 1}
                    </div>

                    <Building2 size={14} className="text-accent flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.company}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail size={11} className="text-muted" />
                        <p className="text-xs text-muted truncate">{item.to}</p>
                      </div>
                    </div>

                    <div className={`text-right min-w-0 flex-shrink-0 ${isRTL ? 'text-left' : ''}`}>
                      <p className="text-xs text-white/60 truncate max-w-36">{item.subject}</p>
                    </div>

                    <button
                      onClick={() => setExpanded(expanded === i ? null : i)}
                      className="p-1 text-muted hover:text-white transition-colors flex-shrink-0"
                    >
                      {expanded === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Expanded preview */}
                  {expanded === i && (
                    <div className="px-4 pb-4 border-t border-border/50 pt-3">
                      <p className="text-xs text-muted mb-2 font-medium uppercase tracking-wider">
                        Email Preview
                      </p>
                      <div
                        className="text-xs text-white/70 leading-relaxed max-h-40 overflow-y-auto prose prose-invert prose-xs"
                        dangerouslySetInnerHTML={{ __html: item.body }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sending phase */}
          {phase === 'sending' && (
            <div className="flex flex-col items-center justify-center p-12 gap-6">
              <Loader2 size={36} className="text-accent animate-spin" />
              <div className="text-center">
                <p className="text-base font-medium text-white mb-1">{t('bulkSending')}</p>
                <p className="text-sm text-muted">
                  {progress.done} / {progress.total} — {progress.current}
                </p>
              </div>
              {/* Progress bar */}
              <div className="w-full max-w-sm h-2 bg-surface-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted">{pct}%</p>
            </div>
          )}

          {/* Done phase */}
          {phase === 'done' && (
            <div className="p-6 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 size={20} className="text-green-400" />
                  <div>
                    <p className="text-lg font-bold text-white">{successCount}</p>
                    <p className="text-xs text-green-400">{t('bulkSuccess')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <XCircle size={20} className="text-red-400" />
                  <div>
                    <p className="text-lg font-bold text-white">{failCount}</p>
                    <p className="text-xs text-red-400">{t('bulkFailed')}</p>
                  </div>
                </div>
              </div>

              {/* Per-item results */}
              <div className="space-y-1.5">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg ${
                      r.success ? 'bg-green-500/5 border border-green-500/15' : 'bg-red-500/5 border border-red-500/15'
                    }`}
                  >
                    {r.success ? (
                      <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle size={14} className="text-red-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{r.company}</p>
                      {r.error && <p className="text-xs text-red-300 truncate">{r.error}</p>}
                    </div>
                    <p className="text-xs text-muted flex-shrink-0">{r.to}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0">
          {phase === 'review' && (
            <>
              <p className="text-xs text-muted">
                {checked.size} {t('selectedCount')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm text-muted hover:text-white hover:bg-surface-200 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleSend}
                  disabled={checked.size === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent hover:bg-accent-light text-sm text-white font-medium disabled:opacity-40 transition-colors"
                >
                  <Send size={14} />
                  {t('approveAndSend')} ({checked.size})
                </button>
              </div>
            </>
          )}

          {phase === 'done' && (
            <button
              onClick={onClose}
              className="ml-auto px-5 py-2 rounded-lg bg-accent hover:bg-accent-light text-sm text-white font-medium transition-colors"
            >
              {t('close')}
            </button>
          )}

          {phase === 'sending' && (
            <p className="text-xs text-muted mx-auto">
              {t('bulkProgress')}... {progress.done}/{progress.total}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
