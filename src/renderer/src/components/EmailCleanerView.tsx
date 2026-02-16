import React, { useState, useEffect, useCallback } from 'react'
import {
  Trash2, FolderPlus, FolderOpen, RefreshCw, CheckSquare, Square,
  Bell, BellOff, MoveRight, Eye, Plus, Edit2, Save, X, AlertTriangle,
  UserPlus, Wifi, WifiOff, ChevronDown, ChevronRight, Settings,
  MailX, Filter, Inbox, Check
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmailConfig {
  imapHost: string; imapPort: number; imapTLS: boolean
  smtpHost: string; smtpPort: number; smtpTLS: boolean
  user: string; password: string; fromName: string
}

interface FolderInfo {
  name: string; path: string; messages: number; unseen: number
}

interface EmailHeader {
  uid: number; from: string; fromEmail: string; subject: string
  date: string; size: number; flags: string[]
  unsubscribeUrl?: string; unsubscribeMail?: string
}

interface EmailFilter {
  id: string; name: string
  field: 'from' | 'subject' | 'to'
  op: 'contains' | 'equals' | 'startsWith' | 'endsWith'
  value: string
  action: 'delete' | 'move' | 'markRead'
  targetFolder?: string
}

interface UnsubResult {
  uid: number; fromEmail: string; success: boolean
  method: 'http' | 'mail' | 'none'; error?: string
}

// ─── Quick-setup presets ──────────────────────────────────────────────────────

const PRESETS: Record<string, Partial<EmailConfig>> = {
  Gmail: { imapHost: 'imap.gmail.com', imapPort: 993, imapTLS: true, smtpHost: 'smtp.gmail.com', smtpPort: 587, smtpTLS: false },
  Outlook: { imapHost: 'outlook.office365.com', imapPort: 993, imapTLS: true, smtpHost: 'smtp.office365.com', smtpPort: 587, smtpTLS: false },
  Yahoo: { imapHost: 'imap.mail.yahoo.com', imapPort: 993, imapTLS: true, smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, smtpTLS: true },
  GMX: { imapHost: 'imap.gmx.com', imapPort: 993, imapTLS: true, smtpHost: 'mail.gmx.com', smtpPort: 587, smtpTLS: false },
  'Web.de': { imapHost: 'imap.web.de', imapPort: 993, imapTLS: true, smtpHost: 'smtp.web.de', smtpPort: 587, smtpTLS: false },
  iCloud: { imapHost: 'imap.mail.me.com', imapPort: 993, imapTLS: true, smtpHost: 'smtp.mail.me.com', smtpPort: 587, smtpTLS: false },
  Custom: {}
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }): React.ReactElement {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${color}`}>{label}</span>
  )
}

function Spinner(): React.ReactElement {
  return <RefreshCw size={14} className="animate-spin text-accent" />
}

function ConfirmButton({
  label, icon: Icon, danger, onClick, loading, disabled
}: {
  label: string; icon: React.ElementType; danger?: boolean; onClick: () => void
  loading?: boolean; disabled?: boolean
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
        danger
          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          : 'bg-surface-100 text-muted hover:text-white hover:bg-surface-200'
      }`}
    >
      {loading ? <Spinner /> : <Icon size={13} />}
      {label}
    </button>
  )
}

// ─── Accounts Tab ─────────────────────────────────────────────────────────────

function AccountsTab({
  accounts, onAccountsChanged, onSelectAccount, selectedIdx
}: {
  accounts: EmailConfig[]
  onAccountsChanged: () => void
  onSelectAccount: (idx: number) => void
  selectedIdx: number
}): React.ReactElement {
  const emptyConfig = (): EmailConfig => ({
    imapHost: '', imapPort: 993, imapTLS: true,
    smtpHost: '', smtpPort: 587, smtpTLS: false,
    user: '', password: '', fromName: ''
  })

  const [editing, setEditing] = useState<{ idx: number; config: EmailConfig } | null>(null)
  const [preset, setPreset] = useState('Gmail')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ imap: boolean; smtp: boolean; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const startAdd = () => {
    const base = PRESETS['Gmail']
    setEditing({ idx: -1, config: { ...emptyConfig(), ...base } })
    setPreset('Gmail')
    setTestResult(null)
  }

  const startEdit = (idx: number) => {
    setEditing({ idx, config: { ...accounts[idx] } })
    setPreset('Custom')
    setTestResult(null)
  }

  const applyPreset = (p: string) => {
    setPreset(p)
    if (editing) {
      setEditing({ ...editing, config: { ...editing.config, ...PRESETS[p] } })
    }
  }

  const update = (key: keyof EmailConfig, val: string | number | boolean) => {
    if (!editing) return
    setEditing({ ...editing, config: { ...editing.config, [key]: val } })
  }

  const handleTest = async () => {
    if (!editing) return
    setTesting(true)
    setTestResult(null)
    try {
      // Temporarily save config for testing
      await window.api.cleaner.saveAccount({ idx: editing.idx, config: editing.config })
      const tempIdx = editing.idx === -1 ? accounts.length : editing.idx
      const res = await window.api.cleaner.testAccount(tempIdx)
      setTestResult(res)
    } catch (e) {
      setTestResult({ imap: false, smtp: false, error: String(e) })
    }
    setTesting(false)
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    await window.api.cleaner.saveAccount({ idx: editing.idx, config: editing.config })
    setSaving(false)
    setEditing(null)
    onAccountsChanged()
  }

  const handleDelete = async (idx: number) => {
    if (!confirm(`Delete account ${accounts[idx]?.user}?`)) return
    await window.api.cleaner.deleteAccount(idx)
    onAccountsChanged()
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Email Accounts</h3>
        <button
          onClick={startAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 text-xs font-medium transition-colors"
        >
          <UserPlus size={13} /> Add Account
        </button>
      </div>

      {/* Account list */}
      <div className="space-y-2">
        {accounts.map((acc, idx) => (
          <div
            key={idx}
            onClick={() => onSelectAccount(idx)}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              selectedIdx === idx
                ? 'border-accent/50 bg-accent/10'
                : 'border-border bg-surface-50 hover:bg-surface-100'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-accent-dark flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {acc.user.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{acc.fromName || acc.user}</p>
              <p className="text-xs text-muted truncate">{acc.user} · {acc.imapHost}</p>
            </div>
            <div className="flex items-center gap-1">
              {selectedIdx === idx && <Badge label="Active" color="bg-accent/20 text-accent" />}
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(idx) }}
                className="p-1.5 text-muted hover:text-white rounded-lg hover:bg-surface-200 transition-colors"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(idx) }}
                className="p-1.5 text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">
            No accounts yet. Click "Add Account" to get started.
          </div>
        )}
      </div>

      {/* Edit / Add form */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-50 border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h4 className="text-sm font-semibold text-white">
                {editing.idx === -1 ? 'Add Email Account' : 'Edit Account'}
              </h4>
              <button onClick={() => setEditing(null)} className="text-muted hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Quick presets */}
              <div>
                <label className="text-xs text-muted mb-1 block">Quick Setup</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(PRESETS).map((p) => (
                    <button
                      key={p}
                      onClick={() => applyPreset(p)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        preset === p ? 'bg-accent text-white' : 'bg-surface-100 text-muted hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic credentials */}
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Display Name</label>
                  <input
                    className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    value={editing.config.fromName}
                    onChange={(e) => update('fromName', e.target.value)}
                    placeholder="Your Name"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Email Address</label>
                  <input
                    className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    value={editing.config.user}
                    onChange={(e) => update('user', e.target.value)}
                    placeholder="you@example.com"
                    type="email"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Password / App Password</label>
                  <input
                    className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    value={editing.config.password}
                    onChange={(e) => update('password', e.target.value)}
                    type="password"
                    placeholder="Password or App Password"
                  />
                </div>
              </div>

              {/* IMAP */}
              <div className="border border-border rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium text-white">IMAP (Receive)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                      value={editing.config.imapHost}
                      onChange={(e) => update('imapHost', e.target.value)}
                      placeholder="imap.example.com"
                    />
                  </div>
                  <input
                    className="bg-surface-100 border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                    type="number"
                    value={editing.config.imapPort}
                    onChange={(e) => update('imapPort', parseInt(e.target.value))}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.config.imapTLS}
                    onChange={(e) => update('imapTLS', e.target.checked)}
                    className="accent-accent"
                  />
                  Use TLS/SSL
                </label>
              </div>

              {/* SMTP */}
              <div className="border border-border rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium text-white">SMTP (Send)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                      value={editing.config.smtpHost}
                      onChange={(e) => update('smtpHost', e.target.value)}
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <input
                    className="bg-surface-100 border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                    type="number"
                    value={editing.config.smtpPort}
                    onChange={(e) => update('smtpPort', parseInt(e.target.value))}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.config.smtpTLS}
                    onChange={(e) => update('smtpTLS', e.target.checked)}
                    className="accent-accent"
                  />
                  Use SSL (port 465)
                </label>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`rounded-lg p-2.5 text-xs flex flex-col gap-1 ${testResult.imap && testResult.smtp ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  <div className="flex gap-3">
                    <span>IMAP: {testResult.imap ? '✓ OK' : '✗ Failed'}</span>
                    <span>SMTP: {testResult.smtp ? '✓ OK' : '✗ Failed'}</span>
                  </div>
                  {testResult.error && <p className="opacity-80">{testResult.error}</p>}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 p-4 border-t border-border">
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-100 text-muted hover:text-white text-xs font-medium transition-colors disabled:opacity-40"
              >
                {testing ? <Spinner /> : <Wifi size={13} />}
                Test Connection
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-2 rounded-lg bg-surface-100 text-muted hover:text-white text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-light transition-colors disabled:opacity-40"
              >
                {saving ? <Spinner /> : <Save size={13} />}
                Save Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Folders Tab ──────────────────────────────────────────────────────────────

function FoldersTab({
  accountIdx
}: { accountIdx: number }): React.ReactElement {
  const [folders, setFolders] = useState<FolderInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const loadFolders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.cleaner.listFolders(accountIdx)
      setFolders(res)
    } catch (e) {
      setMsg(String(e))
    }
    setLoading(false)
  }, [accountIdx])

  useEffect(() => { loadFolders() }, [loadFolders])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setBusy(true)
    try {
      await window.api.cleaner.createFolder({ accountIdx, path: newName.trim() })
      setNewName('')
      setCreating(false)
      await loadFolders()
      setMsg(`Folder "${newName}" created.`)
    } catch (e) { setMsg(String(e)) }
    setBusy(false)
  }

  const handleRename = async (oldPath: string) => {
    if (!renameVal.trim()) return
    setBusy(true)
    try {
      await window.api.cleaner.renameFolder({ accountIdx, oldPath, newPath: renameVal.trim() })
      setRenamingPath(null)
      await loadFolders()
      setMsg('Folder renamed.')
    } catch (e) { setMsg(String(e)) }
    setBusy(false)
  }

  const handleDelete = async (path: string) => {
    if (!confirm(`Delete folder "${path}"? All emails inside will be permanently lost.`)) return
    setBusy(true)
    try {
      await window.api.cleaner.deleteFolder({ accountIdx, path })
      await loadFolders()
      setMsg(`Folder "${path}" deleted.`)
    } catch (e) { setMsg(String(e)) }
    setBusy(false)
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">IMAP Folders</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 text-xs font-medium transition-colors">
            <FolderPlus size={13} /> New Folder
          </button>
          <button onClick={loadFolders} disabled={loading} className="p-1.5 rounded-lg bg-surface-100 text-muted hover:text-white transition-colors">
            {loading ? <Spinner /> : <RefreshCw size={13} />}
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-accent/10 border border-accent/30 text-accent text-xs rounded-lg px-3 py-2 flex items-center gap-2">
          <Check size={12} /> {msg}
        </div>
      )}

      {creating && (
        <div className="flex items-center gap-2 bg-surface-50 border border-border rounded-xl p-3">
          <FolderOpen size={14} className="text-accent flex-shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder-muted"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
            placeholder="Folder name (e.g. Archive/2024)"
          />
          <button onClick={handleCreate} disabled={busy} className="px-2.5 py-1 rounded-lg bg-accent text-white text-xs disabled:opacity-40">
            {busy ? <Spinner /> : 'Create'}
          </button>
          <button onClick={() => setCreating(false)} className="text-muted hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1">
        {folders.map((f) => (
          <div key={f.path} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors">
            <FolderOpen size={14} className="text-accent flex-shrink-0" />
            {renamingPath === f.path ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  autoFocus
                  className="flex-1 bg-surface-100 border border-border rounded px-2 py-1 text-xs text-white focus:outline-none"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRename(f.path); if (e.key === 'Escape') setRenamingPath(null) }}
                />
                <button onClick={() => handleRename(f.path)} className="text-accent hover:text-white text-xs px-2 py-1 bg-accent/20 rounded">Save</button>
                <button onClick={() => setRenamingPath(null)} className="text-muted hover:text-white"><X size={12} /></button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{f.path}</p>
                  <p className="text-xs text-muted">{f.messages} msgs{f.unseen > 0 ? ` · ${f.unseen} unread` : ''}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setRenamingPath(f.path); setRenameVal(f.name) }}
                    className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-200 transition-colors"
                    title="Rename"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(f.path)}
                    className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete folder"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {!loading && folders.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">No folders found.</div>
        )}
      </div>
    </div>
  )
}

// ─── Cleaner Tab ──────────────────────────────────────────────────────────────

function CleanerTab({ accountIdx }: { accountIdx: number }): React.ReactElement {
  const [folders, setFolders] = useState<FolderInfo[]>([])
  const [selectedFolder, setSelectedFolder] = useState('INBOX')
  const [headers, setHeaders] = useState<EmailHeader[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null)
  const [moveDest, setMoveDest] = useState('')
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [limit, setLimit] = useState(100)

  useEffect(() => {
    window.api.cleaner.listFolders(accountIdx).then((f) => {
      setFolders(f)
    }).catch(() => {})
  }, [accountIdx])

  const loadHeaders = async () => {
    setLoading(true)
    setSelected(new Set())
    setMsg(null)
    try {
      const res = await window.api.cleaner.fetchHeaders({ accountIdx, folder: selectedFolder, limit })
      setHeaders(res)
    } catch (e) { setMsg({ text: String(e), type: 'err' }) }
    setLoading(false)
  }

  const toggleAll = () => {
    if (selected.size === headers.length) setSelected(new Set())
    else setSelected(new Set(headers.map((h) => h.uid)))
  }

  const toggleOne = (uid: number) => {
    const s = new Set(selected)
    if (s.has(uid)) s.delete(uid)
    else s.add(uid)
    setSelected(s)
  }

  const handleDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} selected email(s)?`)) return
    setBusy(true)
    try {
      await window.api.cleaner.deleteEmails({ accountIdx, folder: selectedFolder, uids: [...selected] })
      setMsg({ text: `${selected.size} email(s) deleted.`, type: 'ok' })
      setSelected(new Set())
      await loadHeaders()
    } catch (e) { setMsg({ text: String(e), type: 'err' }) }
    setBusy(false)
  }

  const handleEmptyFolder = async () => {
    if (!confirm(`Delete ALL emails in "${selectedFolder}"? This cannot be undone.`)) return
    setBusy(true)
    try {
      const res = await window.api.cleaner.emptyFolder({ accountIdx, folder: selectedFolder })
      setMsg({ text: `Deleted ${res.count} emails from "${selectedFolder}".`, type: 'ok' })
      setHeaders([])
      setSelected(new Set())
    } catch (e) { setMsg({ text: String(e), type: 'err' }) }
    setBusy(false)
  }

  const handleMove = async () => {
    if (selected.size === 0 || !moveDest) return
    setBusy(true)
    try {
      await window.api.cleaner.moveEmails({ accountIdx, folder: selectedFolder, destFolder: moveDest, uids: [...selected] })
      setMsg({ text: `${selected.size} email(s) moved to "${moveDest}".`, type: 'ok' })
      setShowMoveDialog(false)
      setSelected(new Set())
      await loadHeaders()
    } catch (e) { setMsg({ text: String(e), type: 'err' }) }
    setBusy(false)
  }

  const handleMarkRead = async () => {
    if (selected.size === 0) return
    setBusy(true)
    try {
      await window.api.cleaner.markRead({ accountIdx, folder: selectedFolder, uids: [...selected] })
      setMsg({ text: `${selected.size} email(s) marked as read.`, type: 'ok' })
      setSelected(new Set())
    } catch (e) { setMsg({ text: String(e), type: 'err' }) }
    setBusy(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-border space-y-3 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="flex-1 min-w-[160px] bg-surface-100 border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
          >
            {folders.length === 0 && <option value="INBOX">INBOX</option>}
            {folders.map((f) => (
              <option key={f.path} value={f.path}>{f.path} ({f.messages})</option>
            ))}
          </select>
          <select
            className="bg-surface-100 border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
          <button
            onClick={loadHeaders}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-light transition-colors disabled:opacity-40"
          >
            {loading ? <Spinner /> : <RefreshCw size={13} />}
            Load
          </button>
        </div>

        {/* Bulk action bar */}
        {headers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
              {selected.size === headers.length ? <CheckSquare size={14} className="text-accent" /> : <Square size={14} />}
              {selected.size === headers.length ? 'Deselect All' : 'Select All'}
            </button>
            {selected.size > 0 && (
              <span className="text-xs text-accent font-medium">{selected.size} selected</span>
            )}
            <div className="flex-1" />
            <ConfirmButton label="Mark Read" icon={Eye} onClick={handleMarkRead} loading={busy} disabled={selected.size === 0} />
            <ConfirmButton
              label="Move"
              icon={MoveRight}
              onClick={() => setShowMoveDialog(true)}
              disabled={selected.size === 0}
            />
            <ConfirmButton label="Delete Selected" icon={Trash2} danger onClick={handleDelete} loading={busy} disabled={selected.size === 0} />
            <ConfirmButton label="Empty Folder" icon={MailX} danger onClick={handleEmptyFolder} loading={busy} />
          </div>
        )}

        {msg && (
          <div className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${msg.type === 'ok' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {msg.type === 'ok' ? <Check size={12} /> : <AlertTriangle size={12} />}
            {msg.text}
          </div>
        )}
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32 text-muted text-sm gap-2">
            <Spinner /> Loading emails...
          </div>
        )}
        {!loading && headers.length === 0 && (
          <div className="text-center py-12 text-muted text-sm">
            Select a folder and click Load to see emails.
          </div>
        )}
        {!loading && headers.map((h) => (
          <div
            key={h.uid}
            onClick={() => toggleOne(h.uid)}
            className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/40 cursor-pointer transition-colors ${
              selected.has(h.uid) ? 'bg-accent/10' : 'hover:bg-surface-50'
            }`}
          >
            <div className="flex-shrink-0">
              {selected.has(h.uid)
                ? <CheckSquare size={15} className="text-accent" />
                : <Square size={15} className="text-muted" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs truncate max-w-[180px] ${h.flags.includes('\\Seen') ? 'text-muted' : 'text-white font-medium'}`}>
                  {h.fromEmail}
                </span>
                {(h.unsubscribeUrl || h.unsubscribeMail) && (
                  <Badge label="newsletter" color="bg-yellow-500/20 text-yellow-400" />
                )}
              </div>
              <p className={`text-xs truncate ${h.flags.includes('\\Seen') ? 'text-muted' : 'text-white/80'}`}>
                {h.subject || '(No Subject)'}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-muted">{new Date(h.date).toLocaleDateString()}</p>
              <p className="text-xs text-muted">{Math.round(h.size / 1024)} KB</p>
            </div>
          </div>
        ))}
      </div>

      {/* Move dialog */}
      {showMoveDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-50 border border-border rounded-2xl p-5 w-80 space-y-3">
            <h4 className="text-sm font-semibold text-white">Move {selected.size} email(s) to:</h4>
            <select
              className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              value={moveDest}
              onChange={(e) => setMoveDest(e.target.value)}
            >
              <option value="">-- Select folder --</option>
              {folders.filter((f) => f.path !== selectedFolder).map((f) => (
                <option key={f.path} value={f.path}>{f.path}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowMoveDialog(false)} className="flex-1 py-2 rounded-lg bg-surface-100 text-muted text-xs hover:text-white transition-colors">Cancel</button>
              <button onClick={handleMove} disabled={!moveDest || busy} className="flex-1 py-2 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-40 hover:bg-accent-light transition-colors">
                {busy ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Subscriptions Tab ────────────────────────────────────────────────────────

function SubscriptionsTab({ accountIdx }: { accountIdx: number }): React.ReactElement {
  const [folder, setFolder] = useState('INBOX')
  const [subs, setSubs] = useState<EmailHeader[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; from: string } | null>(null)
  const [results, setResults] = useState<UnsubResult[]>([])
  const [msg, setMsg] = useState('')

  const loadSubs = async () => {
    setLoading(true)
    setSelected(new Set())
    setSubs([])
    setResults([])
    try {
      const res = await window.api.cleaner.fetchSubscriptions({ accountIdx, folder })
      setSubs(res)
      setMsg(`Found ${res.length} newsletter/subscription emails.`)
    } catch (e) { setMsg(String(e)) }
    setLoading(false)
  }

  useEffect(() => {
    const off = window.api.cleaner.onUnsubProgress((p) => setProgress(p))
    return off
  }, [])

  const toggleAll = () => {
    if (selected.size === subs.length) setSelected(new Set())
    else setSelected(new Set(subs.map((s) => s.uid)))
  }

  const toggleOne = (uid: number) => {
    const s = new Set(selected)
    if (s.has(uid)) s.delete(uid)
    else s.add(uid)
    setSelected(s)
  }

  const handleUnsubscribe = async () => {
    const items = subs.filter((s) => selected.has(s.uid))
    if (!confirm(`Unsubscribe from ${items.length} sender(s)?`)) return
    setBusy(true)
    setProgress({ done: 0, total: items.length, from: '' })
    try {
      const raw = await window.api.cleaner.bulkUnsubscribe({ accountIdx, items })
      const res = raw as UnsubResult[]
      setResults(res)
      const ok = res.filter((r) => r.success).length
      setMsg(`Unsubscribed from ${ok}/${items.length} senders.`)
    } catch (e) { setMsg(String(e)) }
    setProgress(null)
    setBusy(false)
  }

  // Group by sender for unique senders
  const grouped = subs.reduce<Record<string, EmailHeader[]>>((acc, h) => {
    if (!acc[h.fromEmail]) acc[h.fromEmail] = []
    acc[h.fromEmail].push(h)
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-border space-y-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 bg-surface-100 border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="Folder (e.g. INBOX)"
          />
          <button
            onClick={loadSubs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-light transition-colors disabled:opacity-40"
          >
            {loading ? <Spinner /> : <Bell size={13} />}
            Scan
          </button>
        </div>

        {subs.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
              {selected.size === subs.length ? <CheckSquare size={14} className="text-accent" /> : <Square size={14} />}
              Select All ({subs.length})
            </button>
            {selected.size > 0 && (
              <>
                <span className="text-xs text-accent font-medium">{selected.size} selected</span>
                <div className="flex-1" />
                <ConfirmButton label={`Unsubscribe (${selected.size})`} icon={BellOff} danger onClick={handleUnsubscribe} loading={busy} />
              </>
            )}
          </div>
        )}

        {progress && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Unsubscribing... {progress.done}/{progress.total}</span>
              {progress.from && <span className="truncate max-w-[200px]">{progress.from}</span>}
            </div>
            <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {msg && (
          <div className="text-xs bg-accent/10 border border-accent/30 text-accent rounded-lg px-3 py-2">
            {msg}
          </div>
        )}
      </div>

      {/* Results summary */}
      {results.length > 0 && (
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-400">{results.filter((r) => r.success).length}</p>
              <p className="text-xs text-muted mt-0.5">Unsubscribed</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-red-400">{results.filter((r) => !r.success).length}</p>
              <p className="text-xs text-muted mt-0.5">Failed</p>
            </div>
          </div>
        </div>
      )}

      {/* Subscription list grouped by sender */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32 text-muted text-sm gap-2">
            <Spinner /> Scanning for subscriptions...
          </div>
        )}
        {!loading && subs.length === 0 && (
          <div className="text-center py-12 text-muted text-sm">
            <BellOff size={32} className="mx-auto mb-3 opacity-30" />
            Click Scan to find newsletter/subscription emails.
          </div>
        )}
        {Object.entries(grouped).map(([email, items]) => {
          const anySelected = items.some((i) => selected.has(i.uid))
          const allSelected = items.every((i) => selected.has(i.uid))
          const result = results.find((r) => r.fromEmail === email)

          return (
            <div key={email} className="border-b border-border/40">
              <div
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  allSelected ? 'bg-accent/10' : anySelected ? 'bg-accent/5' : 'hover:bg-surface-50'
                }`}
                onClick={() => {
                  const allUids = items.map((i) => i.uid)
                  const s = new Set(selected)
                  if (allSelected) allUids.forEach((u) => s.delete(u))
                  else allUids.forEach((u) => s.add(u))
                  setSelected(s)
                }}
              >
                {allSelected
                  ? <CheckSquare size={15} className="text-accent flex-shrink-0" />
                  : <Square size={15} className="text-muted flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{email}</p>
                  <p className="text-xs text-muted">{items.length} email(s) · {items[0]?.unsubscribeUrl ? 'HTTP unsub' : 'Mail unsub'}</p>
                </div>
                {result && (
                  <Badge
                    label={result.success ? 'Unsubscribed' : 'Failed'}
                    color={result.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Filters Tab ─────────────────────────────────────────────────────────────

function FiltersTab({ accountIdx }: { accountIdx: number }): React.ReactElement {
  const [filters, setFilters] = useState<EmailFilter[]>([])
  const [folders, setFolders] = useState<FolderInfo[]>([])
  const [editing, setEditing] = useState<EmailFilter | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.cleaner.getFilters().then(setFilters).catch(() => {})
    window.api.cleaner.listFolders(accountIdx).then(setFolders).catch(() => {})
  }, [accountIdx])

  const emptyFilter = (): EmailFilter => ({
    id: Date.now().toString(),
    name: '',
    field: 'from',
    op: 'contains',
    value: '',
    action: 'delete'
  })

  const save = async (f: EmailFilter[]) => {
    await window.api.cleaner.saveFilters(f)
    setFilters(f)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveFilter = async () => {
    if (!editing) return
    const updated = filters.find((f) => f.id === editing.id)
      ? filters.map((f) => (f.id === editing.id ? editing : f))
      : [...filters, editing]
    await save(updated)
    setEditing(null)
  }

  const handleDelete = async (id: string) => {
    await save(filters.filter((f) => f.id !== id))
  }

  const upd = (k: keyof EmailFilter, v: string) => {
    if (!editing) return
    setEditing({ ...editing, [k]: v })
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Email Filters</h3>
          <p className="text-xs text-muted mt-0.5">Auto-rules applied when loading emails (delete, move, mark read)</p>
        </div>
        <button
          onClick={() => setEditing(emptyFilter())}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 text-xs font-medium transition-colors"
        >
          <Plus size={13} /> New Filter
        </button>
      </div>

      {saved && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg px-3 py-2 flex items-center gap-2">
          <Check size={12} /> Filters saved.
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        {filters.map((f) => (
          <div key={f.id} className="bg-surface-50 border border-border rounded-xl p-3 flex items-start gap-3">
            <Filter size={14} className="text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">{f.name || 'Unnamed filter'}</p>
              <p className="text-xs text-muted mt-0.5">
                If <span className="text-white">{f.field}</span> {f.op} "<span className="text-accent">{f.value}</span>"
                → <span className="text-white">{f.action}</span>
                {f.targetFolder ? ` to "${f.targetFolder}"` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setEditing(f)} className="p-1.5 text-muted hover:text-white rounded-lg hover:bg-surface-200 transition-colors">
                <Edit2 size={12} />
              </button>
              <button onClick={() => handleDelete(f.id)} className="p-1.5 text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {filters.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">
            No filters yet. Create a rule to auto-organize your inbox.
          </div>
        )}
      </div>

      {/* Filter editor dialog */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-50 border border-border rounded-2xl w-full max-w-md space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Edit Filter Rule</h4>
              <button onClick={() => setEditing(null)} className="text-muted hover:text-white"><X size={15} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Filter Name</label>
                <input
                  className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                  value={editing.name}
                  onChange={(e) => upd('name', e.target.value)}
                  placeholder="e.g. Delete promotions"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted mb-1 block">Field</label>
                  <select className="w-full bg-surface-100 border border-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none" value={editing.field} onChange={(e) => upd('field', e.target.value)}>
                    <option value="from">From</option>
                    <option value="subject">Subject</option>
                    <option value="to">To</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Condition</label>
                  <select className="w-full bg-surface-100 border border-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none" value={editing.op} onChange={(e) => upd('op', e.target.value)}>
                    <option value="contains">contains</option>
                    <option value="equals">equals</option>
                    <option value="startsWith">starts with</option>
                    <option value="endsWith">ends with</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Value</label>
                  <input
                    className="w-full bg-surface-100 border border-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    value={editing.value}
                    onChange={(e) => upd('value', e.target.value)}
                    placeholder="e.g. noreply@"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Action</label>
                <select className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none" value={editing.action} onChange={(e) => upd('action', e.target.value)}>
                  <option value="delete">Delete</option>
                  <option value="move">Move to folder</option>
                  <option value="markRead">Mark as read</option>
                </select>
              </div>

              {editing.action === 'move' && (
                <div>
                  <label className="text-xs text-muted mb-1 block">Target Folder</label>
                  <select
                    className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    value={editing.targetFolder ?? ''}
                    onChange={(e) => upd('targetFolder', e.target.value)}
                  >
                    <option value="">-- Select folder --</option>
                    {folders.map((f) => (
                      <option key={f.path} value={f.path}>{f.path}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg bg-surface-100 text-muted text-xs hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSaveFilter} className="flex-1 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-light transition-colors">
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'accounts', label: 'Accounts', icon: Settings },
  { id: 'cleaner', label: 'Cleaner', icon: Trash2 },
  { id: 'folders', label: 'Folders', icon: FolderOpen },
  { id: 'subscriptions', label: 'Subscriptions', icon: BellOff },
  { id: 'filters', label: 'Filters', icon: Filter }
] as const

type Tab = (typeof TABS)[number]['id']

export default function EmailCleanerView(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('accounts')
  const [accounts, setAccounts] = useState<EmailConfig[]>([])
  const [accountIdx, setAccountIdx] = useState(0)

  const loadAccounts = useCallback(async () => {
    try {
      const res = await window.api.cleaner.listAccounts()
      setAccounts(res)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Inbox size={20} className="text-accent" />
              Email Cleaner
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Manage spam, folders, subscriptions and filter rules
            </p>
          </div>
          {accounts.length > 1 && (
            <select
              className="bg-surface-100 border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
              value={accountIdx}
              onChange={(e) => setAccountIdx(parseInt(e.target.value))}
            >
              {accounts.map((a, i) => (
                <option key={i} value={i}>{a.user}</option>
              ))}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === id
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-white hover:bg-surface-100'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'accounts' && (
          <AccountsTab
            accounts={accounts}
            onAccountsChanged={loadAccounts}
            onSelectAccount={setAccountIdx}
            selectedIdx={accountIdx}
          />
        )}
        {tab === 'cleaner' && <CleanerTab accountIdx={accountIdx} />}
        {tab === 'folders' && <FoldersTab accountIdx={accountIdx} />}
        {tab === 'subscriptions' && <SubscriptionsTab accountIdx={accountIdx} />}
        {tab === 'filters' && <FiltersTab accountIdx={accountIdx} />}
      </div>
    </div>
  )
}
