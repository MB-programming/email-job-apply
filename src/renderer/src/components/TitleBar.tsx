import React from 'react'
import { Minus, Square, X, Zap } from 'lucide-react'

export default function TitleBar(): React.ReactElement {
  const minimize = () => window.api.window.minimize()
  const maximize = () => window.api.window.maximize()
  const close = () => window.api.window.close()

  return (
    <div
      className="flex items-center justify-between h-10 px-4 bg-surface-50 border-b border-border flex-shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-white tracking-wide">MailBot</span>
        <span className="text-xs text-muted px-2 py-0.5 rounded-full bg-surface-200">
          Job Apply Automation
        </span>
      </div>

      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={minimize}
          className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-white hover:bg-surface-300 transition-colors"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={maximize}
          className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-white hover:bg-surface-300 transition-colors"
        >
          <Square size={12} />
        </button>
        <button
          onClick={close}
          className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-white hover:bg-red-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
