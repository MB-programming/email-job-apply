import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Paperclip,
  StopCircle,
  Bot,
  User,
  Sparkles,
  Trash2
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { ChatMessageType } from '../types/electron.d'

const SUGGESTIONS = [
  'Find programming companies in Vienna, Austria',
  'Write a job application email in German',
  'Show me IT companies in Graz and Linz',
  'Draft a follow-up email for my application'
]

function generateId(): string {
  return Math.random().toString(36).slice(2)
}

export default function ChatView(): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachment, setAttachment] = useState<{ path: string; filename: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessageType = {
      id: generateId(),
      role: 'user',
      content: input.trim() + (attachment ? `\n\n[Attached: ${attachment.filename}]` : ''),
      timestamp: new Date()
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setAttachment(null)
    setIsLoading(true)
    abortRef.current = false

    const assistantId = generateId()
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      }
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
        { role: 'user' as const, content: userMessage.content }
      ]

      await window.api.openai.chat(history)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${errMsg}`, isStreaming: false }
            : m
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

  const handleAttach = async () => {
    const file = await window.api.email.pickAttachment()
    if (file) setAttachment(file)
  }

  const handleClear = () => {
    setMessages([])
  }

  const autoResize = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
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
            <h1 className="text-base font-semibold text-white">AI Job Assistant</h1>
            <p className="text-xs text-muted">Powered by GPT-4o</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white px-3 py-1.5 rounded-lg hover:bg-surface-200 transition-colors"
          >
            <Trash2 size={13} />
            Clear chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-8 pb-16">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent mx-auto mb-4 flex items-center justify-center">
                <Bot size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">What can I help you with?</h2>
              <p className="text-sm text-muted max-w-sm">
                I can find companies, write application emails in German, and send them for you.
              </p>
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
            {/* Avatar */}
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

            {/* Bubble */}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-tr-sm'
                  : 'bg-surface-100 text-white/90 rounded-tl-sm border border-border'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content || (msg.isStreaming ? '...' : '')}</ReactMarkdown>
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
            <button
              onClick={() => setAttachment(null)}
              className="text-muted hover:text-white ml-1"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex items-end gap-3 bg-surface-100 rounded-2xl border border-border px-4 py-3">
          <button
            onClick={handleAttach}
            className="text-muted hover:text-white transition-colors flex-shrink-0 mb-0.5"
            title="Attach CV or file"
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
            placeholder="Ask me to find companies, write emails, send applications..."
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
        <p className="text-xs text-muted mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
