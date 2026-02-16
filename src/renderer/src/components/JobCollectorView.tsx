import React, { useState, useRef, useEffect } from 'react'
import {
  Play, Square, Download, FileSpreadsheet, FileText,
  Briefcase, Building2, Mail, ExternalLink, CheckSquare,
  Square as SquareIcon, Search, Globe
} from 'lucide-react'
import { useLang } from '../contexts/LanguageContext'

interface CollectedJob {
  title: string
  company: string
  location: string
  date: string
  description: string
  applyUrl: string
  email: string
  source: string
}

const SOURCES = [
  { id: 'karriere', label: 'Karriere.at', flag: '🇦🇹' },
  { id: 'linkedin', label: 'LinkedIn', flag: '💼' },
  { id: 'indeed', label: 'Indeed', flag: '🔍' }
]

export default function JobCollectorView(): React.ReactElement {
  const { t } = useLang()

  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('Vienna, Austria')
  const [maxResults, setMaxResults] = useState(30)
  const [selectedSources, setSelectedSources] = useState(['karriere', 'linkedin'])
  const [running, setRunning] = useState(false)
  const [jobs, setJobs] = useState<CollectedJob[]>([])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [statusMsg, setStatusMsg] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const abortRef = useRef(false)
  const jobsRef = useRef<CollectedJob[]>([])

  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  const toggleSource = (id: string) =>
    setSelectedSources((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const toggleJob = (i: number) => {
    const next = new Set(checked)
    if (next.has(i)) next.delete(i); else next.add(i)
    setChecked(next)
  }

  const toggleAll = () => {
    if (checked.size === jobs.length) setChecked(new Set())
    else setChecked(new Set(jobs.map((_, i) => i)))
  }

  const handleStart = async () => {
    if (!keyword.trim() || running) return
    setRunning(true)
    setJobs([])
    setChecked(new Set())
    setStatusMsg('Starting collection...')
    abortRef.current = false

    // Listen for streamed jobs
    window.api.collector.onJob((rawJob: unknown) => {
      const job = rawJob as CollectedJob
      if (abortRef.current) return
      setJobs((prev) => [...prev, job])
      setStatusMsg(`Found: ${job.title} @ ${job.company} (${job.source})`)
    })

    window.api.collector.onDone(({ total }: { total: number }) => {
      setStatusMsg(`✅ Done! Collected ${total} jobs.`)
      setRunning(false)
      window.api.collector.removeListeners()
    })

    try {
      await window.api.collector.start({
        keyword: keyword.trim(),
        location: location.trim(),
        maxResults,
        sources: selectedSources
      })
    } catch (err) {
      setStatusMsg(`Error: ${err}`)
    } finally {
      setRunning(false)
      window.api.collector.removeListeners()
    }
  }

  const handleStop = () => {
    abortRef.current = true
    setRunning(false)
    setStatusMsg(`Stopped. ${jobs.length} jobs collected.`)
    window.api.collector.removeListeners()
  }

  const handleExportExcel = async () => {
    setExporting('excel')
    await window.api.export.jobsExcel(jobs)
    setExporting(null)
  }

  const handleExportWord = async () => {
    setExporting('word')
    await window.api.export.jobsWord(jobs)
    setExporting(null)
  }

  const selectedJobs = jobs.filter((_, i) => checked.has(i))

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <Globe size={15} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Job Collector Bot</h1>
          <p className="text-xs text-muted">بوت جمع الوظائف — مرئي في وقت حقيقي</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — controls */}
        <div className="w-72 flex-shrink-0 border-r border-border p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="block text-xs text-muted mb-1">Job Keyword *</label>
            <input
              className="w-full bg-surface-100 border border-border rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-accent placeholder-muted"
              placeholder="e.g. React Developer"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Location</label>
            <input
              className="w-full bg-surface-100 border border-border rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-accent placeholder-muted"
              placeholder="Vienna, Austria"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Max Results</label>
            <select
              className="w-full bg-surface-100 border border-border rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-accent"
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
            >
              {[10, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted mb-2">Sources (visible browser opens per platform)</label>
            <div className="space-y-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-100 border border-border hover:border-accent/50 transition-colors text-sm text-left"
                >
                  {selectedSources.includes(s.id) ? (
                    <CheckSquare size={14} className="text-accent flex-shrink-0" />
                  ) : (
                    <SquareIcon size={14} className="text-muted flex-shrink-0" />
                  )}
                  <span className="mr-1">{s.flag}</span>
                  <span className={selectedSources.includes(s.id) ? 'text-white' : 'text-muted'}>{s.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-2 leading-relaxed">
              سيفتح نافذة مرئية لكل منصة حتى ترى عملية الجمع
            </p>
          </div>

          {/* Start / Stop */}
          {!running ? (
            <button
              onClick={handleStart}
              disabled={!keyword.trim() || selectedSources.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent hover:bg-accent-light text-sm text-white font-medium disabled:opacity-40 transition-colors"
            >
              <Play size={15} />
              Start Collection
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-sm text-red-400 font-medium transition-colors"
            >
              <Square size={15} />
              Stop
            </button>
          )}

          {/* Status */}
          {statusMsg && (
            <div className="text-xs text-muted bg-surface-100 rounded-lg px-3 py-2 leading-relaxed">
              {statusMsg}
            </div>
          )}

          {/* Export */}
          {jobs.length > 0 && !running && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted">Export {jobs.length} jobs</p>
              <button
                onClick={handleExportExcel}
                disabled={!!exporting}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-sm text-green-400 transition-colors disabled:opacity-40"
              >
                <FileSpreadsheet size={14} />
                {exporting === 'excel' ? 'Saving...' : 'Export to Excel'}
              </button>
              <button
                onClick={handleExportWord}
                disabled={!!exporting}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-sm text-blue-400 transition-colors disabled:opacity-40"
              >
                <FileText size={14} />
                {exporting === 'word' ? 'Saving...' : 'Export to Word'}
              </button>
            </div>
          )}
        </div>

        {/* Right panel — results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {jobs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center">
                <Search size={28} className="text-muted" />
              </div>
              <div>
                <p className="text-base font-semibold text-white mb-1">Job Collector Bot</p>
                <p className="text-sm text-muted max-w-sm leading-relaxed">
                  Enter a job title and click Start. A browser window will open for each platform and collect jobs in real-time — you can watch it work!
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Results header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
                    {checked.size === jobs.length ? <CheckSquare size={13} className="text-accent" /> : <SquareIcon size={13} />}
                    Select All
                  </button>
                  <span className="text-xs text-muted">{jobs.length} jobs collected</span>
                  {running && (
                    <span className="flex items-center gap-1 text-xs text-accent">
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                      Collecting...
                    </span>
                  )}
                </div>
              </div>

              {/* Job list */}
              <div className="flex-1 overflow-y-auto">
                {jobs.map((job, i) => (
                  <div
                    key={i}
                    className={`border-b border-border/40 ${checked.has(i) ? 'bg-surface-100/30' : ''} hover:bg-surface-100/20 transition-colors`}
                  >
                    <div className="flex items-center gap-3 px-5 py-3">
                      <button onClick={() => toggleJob(i)} className="flex-shrink-0">
                        {checked.has(i) ? <CheckSquare size={14} className="text-accent" /> : <SquareIcon size={14} className="text-muted" />}
                      </button>

                      <Building2 size={14} className="text-accent flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{job.title}</p>
                        <p className="text-xs text-muted truncate">{job.company} · {job.location}</p>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {job.date && <span className="text-xs text-muted">{job.date}</span>}
                        {job.email && (
                          <div className="flex items-center gap-1">
                            <Mail size={11} className="text-green-400" />
                            <span className="text-xs text-green-400">{job.email}</span>
                          </div>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-200 text-muted">{job.source}</span>
                        {job.applyUrl && (
                          <a
                            href={job.applyUrl}
                            onClick={(e) => { e.preventDefault(); window.open(job.applyUrl) }}
                            className="p-1 text-muted hover:text-white transition-colors"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                        <button
                          onClick={() => setExpanded(expanded === i ? null : i)}
                          className="p-1 text-muted hover:text-white text-xs"
                        >
                          {expanded === i ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded description */}
                    {expanded === i && job.description && (
                      <div className="px-12 pb-4">
                        <p className="text-xs text-white/60 leading-relaxed bg-surface-100 rounded-lg p-3">{job.description}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
