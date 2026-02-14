import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Paperclip,
  StopCircle,
  Bot,
  User,
  Sparkles,
  Trash2,
  ChevronDown
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useLang } from '../contexts/LanguageContext'
import BulkApprovalModal, { type BulkEmailItem } from './BulkApprovalModal'

interface ChatMessageType {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

function generateId(): string {
  return Math.random().toString(36).slice(2)
}

function extractBulkPlan(text: string): BulkEmailItem[] | null {
  const match = text.match(/```bulk_email_plan\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1].trim())
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].to) return parsed
  } catch {
    // not valid JSON
  }
  return null
}

function stripBulkBlock(text: string): string {
  return text.replace(/```bulk_email_plan[\s\S]*?```/g, '').trim()
}

export default function ChatView(): React.ReactElement {
  const { t } = useLang()
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachment, setAttachment] = useState<{ path: string; filename: string } | null>(null)
  const [bulkPlan, setBulkPlan] = useState<BulkEmailItem[] | null>(null)
  const [modelName, setModelName] = useState<string>('')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [allModels, setAllModels] = useState<{ id: string; name: string; tier: string }[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef(false)

  const SUGGESTIONS = [
    t('suggestion1'),
    t('suggestion2'),
    t('suggestion3'),
    t('suggestion4')
  ]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    loadModel()
  }, [])

  const loadModel = async () => {
    const [mods, sel] = await Promise.all([
      window.api.openai.getModels(),
      window.api.openai.getSelectedModel()
    ])
    setAllModels(mods || [])
    const def = (mods || []).find((m: { id: string }) => m.id === sel)
    if (def) setModelName((def as { name: string }).name)
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userContent = input.trim() + (attachment ? `\n\n[Attached: ${attachment.filename}]` : '')
    const userMsg: ChatMessageType = {
      id: generateId(),
      role: 'user',
      content: userContent,
      timestamp: new Date()
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setAttachment(null)
    setIsLoading(true)
    abortRef.current = false

    const assistantId = generateId()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true }
    ])

    try {
      window.api.openai.onStreamChunk((chunk) => {
        if (abortRef.current) return
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + chunk.delta, isStreaming: !chunk.done }
              : m
          )
        )
      })

      const history = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userContent }
      ]

      const fullResponse = await window.api.openai.chat(history)

      const plan = extractBulkPlan(fullResponse)
      if (plan && plan.length > 0) {
        const profile = await window.api.settings.getProfile()
        if (profile?.cvPath) {
          plan.forEach((item: BulkEmailItem) => {
            ;(item as BulkEmailItem & { attachments?: { filename: string; path: string }[] }).attachments = [
              { filename: 'CV.pdf', path: profile.cvPath as string }
            ]
          })
        }
        setTimeout(() => setBulkPlan(plan), 300)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `Error: ${errMsg}`, isStreaming: false } : m
        )
      )
    } finally {
      window.api.openai.removeStreamListeners()
      setIsLoading(false)
    }
  }, [input, isLoading, messages, attachment])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const autoResize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }

  const switchModel = async (modelId: string) => {
    await window.api.openai.setSelectedModel(modelId)
    await loadModel()
    setShowModelPicker(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">{t('chatTitle')}</h1>
            <p className="text-xs text-muted">{t('chatSubtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model picker button */}
          <div className="relative">
            <button
              onClick={() => setShowModelPicker((v) => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-100 border border-border hover:border-accent text-white/70 hover:text-white transition-colors"
            >
              <Bot size={12} />
              {modelName || 'Select Model'}
              <ChevronDown size={11} />
            </button>
            {showModelPicker && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-surface-50 border border-border rounded-xl shadow-xl z-30 overflow-hidden">
                {allModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => switchModel(m.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-surface-100 transition-colors"
                  >
                    <span className="text-white/80">{m.name}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        m.tier === 'free'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-yellow-500/10 text-yellow-400'
                      }`}
                    >
                      {m.tier === 'free' ? 'FREE' : 'PAID'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white px-3 py-1.5 rounded-lg hover:bg-surface-200 transition-colors"
            >
              <Trash2 size={13} />
              {t('clearChat')}
            </button>
          )}
        </div>
      </div>

      {/* Click-outside to close model picker */}
      {showModelPicker && (
        <div className="fixed inset-0 z-20" onClick={() => setShowModelPicker(false)} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-8 pb-16">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent mx-auto mb-4 flex items-center justify-center">
                <Bot size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">{t('whatCanIHelp')}</h2>
              <p className="text-sm text-muted max-w-sm">{t('chatDescription')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s)
                    textareaRef.current?.focus()
                  }}
                  className="text-left px-4 py-3 rounded-xl bg-surface-100 border border-border hover:border-accent hover:bg-surface-200 transition-all text-sm text-white/80"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                msg.role === 'assistant' ? 'bg-accent' : 'bg-surface-300'
              }`}
            >
              {msg.role === 'assistant' ? (
                <Bot size={16} className="text-white" />
              ) : (
                <User size={16} className="text-white" />
              )}
            </div>

            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-tr-sm'
                  : 'bg-surface-100 text-white/90 rounded-tl-sm border border-border'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{stripBulkBlock(msg.content)}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              {msg.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-accent animate-pulse ml-0.5" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-6 py-4 border-t border-border flex-shrink-0">
        {attachment && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-surface-100 rounded-lg w-fit">
            <Paperclip size={13} className="text-accent" />
            <span className="text-xs text-white/80">{attachment.filename}</span>
            <button onClick={() => setAttachment(null)} className="text-muted hover:text-white ml-1">
              ×
            </button>
          </div>
        )}
        <div className="flex items-end gap-3 bg-surface-100 rounded-2xl border border-border px-4 py-3">
          <button
            onClick={async () => {
              const file = await window.api.email.pickAttachment()
              if (file) setAttachment(file)
            }}
            className="text-muted hover:text-white transition-colors flex-shrink-0 mb-0.5"
            title="Attach CV"
          >
            <Paperclip size={18} />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              autoResize()
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('chatPlaceholder')}
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder-muted resize-none outline-none leading-relaxed max-h-40"
          />

          {isLoading ? (
            <button
              onClick={() => {
                abortRef.current = true
                window.api.openai.removeStreamListeners()
                setIsLoading(false)
                setMessages((prev) =>
                  prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
                )
              }}
              className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0 mb-0.5"
            >
              <StopCircle size={20} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="text-accent hover:text-accent-light disabled:text-surface-400 transition-colors flex-shrink-0 mb-0.5"
            >
              <Send size={18} />
            </button>
          )}
        </div>
        <p className="text-xs text-muted mt-2 text-center">{t('pressEnter')}</p>
      </div>

      {/* Bulk approval modal */}
      {bulkPlan && (
        <BulkApprovalModal items={bulkPlan} onClose={() => setBulkPlan(null)} />
      )}
    </div>
  )
}
