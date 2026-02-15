import React, { useState } from 'react'
import {
  Briefcase,
  Search,
  Mail,
  Building2,
  CheckSquare,
  Square,
  Send,
  Loader2,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
import { useLang } from '../contexts/LanguageContext'
import BulkApprovalModal, { type BulkEmailItem } from './BulkApprovalModal'

interface JobResult {
  title: string
  company: string
  location: string
  url: string
  email?: string
  source: string
}

const SOURCES = ['Karriere.at', 'LinkedIn', 'Indeed', 'XING', 'StepStone']

// Map display names to scraping source IDs
const SOURCE_IDS: Record<string, string> = {
  'Karriere.at': 'karriere',
  'LinkedIn': 'linkedin',
  'Indeed': 'indeed',
  'XING': 'xing',
  'StepStone': 'stepstone'
}

export default function JobsView(): React.ReactElement {
  const { t } = useLang()

  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('Vienna, Austria')
  const [maxResults, setMaxResults] = useState(20)
  const [selectedSources, setSelectedSources] = useState<string[]>(['Karriere.at', 'LinkedIn'])
  const [searching, setSearching] = useState(false)
  const [progress, setProgress] = useState('')
  const [jobs, setJobs] = useState<JobResult[]>([])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [extractingIdx, setExtractingIdx] = useState<number | null>(null)
  const [bulkPlan, setBulkPlan] = useState<BulkEmailItem[] | null>(null)

  const toggleSource = (s: string) => {
    setSelectedSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  const toggleJob = (i: number) => {
    const next = new Set(checked)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setChecked(next)
  }

  const toggleAll = () => {
    if (checked.size === jobs.length) setChecked(new Set())
    else setChecked(new Set(jobs.map((_, i) => i)))
  }

  const handleSearch = async () => {
    if (!keyword.trim() || searching) return
    setSearching(true)
    setJobs([])
    setChecked(new Set())
    setProgress('')

    window.api.scraping.onProgress((p) => {
      setProgress(`${p.msg} (${p.found} found)`)
    })

    try {
      const results = await window.api.scraping.search({
        keyword: keyword.trim(),
        location: location.trim(),
        maxResults,
        sources: selectedSources.map((s) => SOURCE_IDS[s] || s.toLowerCase())
      })
      setJobs(results as JobResult[])
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      window.api.scraping.removeProgressListeners()
      setSearching(false)
      setProgress('')
    }
  }

  const extractEmail = async (idx: number) => {
    if (!jobs[idx].url) return
    setExtractingIdx(idx)
    try {
      const email = await window.api.scraping.extractEmail(jobs[idx].url)
      if (email) {
        setJobs((prev) =>
          prev.map((j, i) => (i === idx ? { ...j, email } : j))
        )
      }
    } catch {
      // ignore
    } finally {
      setExtractingIdx(null)
    }
  }

  const handleApply = async () => {
    const selectedJobs = jobs.filter((_, i) => checked.has(i) && jobs[i].email)
    if (selectedJobs.length === 0) return

    const profile = await window.api.settings.getProfile()
    const senderName = profile?.fullName || 'Applicant'
    const senderSkills = profile?.skills || ''
    const cvPath = profile?.cvPath || ''

    // Generate email for each job using the AI
    const plan: BulkEmailItem[] = selectedJobs.map((job) => ({
      company: job.company,
      to: job.email!,
      subject: `Application: ${keyword} — ${senderName}`,
      body: `Dear ${job.company} team,\n\nI am interested in the ${job.title} position at your company.\n\nSkills: ${senderSkills}\n\nBest regards,\n${senderName}`,
      attachments: cvPath ? [{ filename: 'CV.pdf', path: cvPath }] : undefined
    }))

    setBulkPlan(plan)
  }

  const jobsWithEmail = jobs.filter((j) => j.email).length
  const selectedWithEmail = jobs.filter((_, i) => checked.has(i) && jobs[i].email).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <Briefcase size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">{t('jobScraperTitle')}</h1>
          <p className="text-xs text-muted">{t('jobScraperDesc')}</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Search Panel */}
        <div className="w-72 flex-shrink-0 border-r border-border p-5 flex flex-col gap-5 overflow-y-auto">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted mb-1.5">{t('keyword')}</label>
              <input
                className="w-full bg-surface-100 border border-border rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-accent transition-colors placeholder-muted"
                placeholder={t('keywordPlaceholder')}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1.5">{t('location')}</label>
              <input
                className="w-full bg-surface-100 border border-border rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-accent transition-colors placeholder-muted"
                placeholder={t('locationPlaceholder')}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1.5">{t('maxResults')}</label>
              <select
                className="w-full bg-surface-100 border border-border rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-accent transition-colors"
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1.5">{t('sources')}</label>
              <div className="space-y-1.5">
                {SOURCES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSource(s)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-100 border border-border hover:border-accent/50 transition-colors text-sm text-left"
                  >
                    {selectedSources.includes(s) ? (
                      <CheckSquare size={14} className="text-accent flex-shrink-0" />
                    ) : (
                      <Square size={14} className="text-muted flex-shrink-0" />
                    )}
                    <span className={selectedSources.includes(s) ? 'text-white' : 'text-muted'}>{s}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={!keyword.trim() || searching || selectedSources.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent hover:bg-accent-light text-sm text-white font-medium disabled:opacity-40 transition-colors"
          >
            {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {searching ? t('searching') : t('searchJobs')}
          </button>

          {progress && (
            <p className="text-xs text-muted text-center">{progress}</p>
          )}
        </div>

        {/* Results Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {jobs.length === 0 && !searching ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Briefcase size={40} className="text-muted mx-auto mb-3" />
                <p className="text-sm text-muted">{t('noJobsFound')}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Results header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleAll}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
                  >
                    {checked.size === jobs.length && jobs.length > 0 ? (
                      <CheckSquare size={13} className="text-accent" />
                    ) : (
                      <Square size={13} />
                    )}
                    {t('selectAll')}
                  </button>
                  <span className="text-xs text-muted">
                    {jobs.length} {t('jobsFound')} · {jobsWithEmail} with email
                  </span>
                </div>

                {selectedWithEmail > 0 && (
                  <button
                    onClick={handleApply}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-light text-xs text-white font-medium transition-colors"
                  >
                    <Send size={12} />
                    {t('applySelected')} ({selectedWithEmail})
                  </button>
                )}
              </div>

              {/* Results list */}
              <div className="flex-1 overflow-y-auto">
                {jobs.map((job, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-5 py-3.5 border-b border-border/40 hover:bg-surface-100/50 transition-colors ${
                      checked.has(i) ? 'bg-surface-100/30' : ''
                    }`}
                  >
                    <button onClick={() => toggleJob(i)} className="flex-shrink-0">
                      {checked.has(i) ? (
                        <CheckSquare size={15} className="text-accent" />
                      ) : (
                        <Square size={15} className="text-muted" />
                      )}
                    </button>

                    <Building2 size={14} className="text-accent flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{job.title}</p>
                      <p className="text-xs text-muted truncate">{job.company} · {job.location}</p>
                    </div>

                    {/* Email column */}
                    <div className="w-48 flex-shrink-0">
                      {job.email ? (
                        <div className="flex items-center gap-1">
                          <Mail size={11} className="text-green-400 flex-shrink-0" />
                          <span className="text-xs text-green-400 truncate">{job.email}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => extractEmail(i)}
                          disabled={extractingIdx === i}
                          className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors disabled:opacity-50"
                        >
                          {extractingIdx === i ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <RefreshCw size={11} />
                          )}
                          {extractingIdx === i ? t('extractingEmail') : 'Extract email'}
                        </button>
                      )}
                    </div>

                    {/* Source badge */}
                    <span className="text-xs px-2 py-0.5 rounded-md bg-surface-200 text-muted flex-shrink-0">
                      {job.source}
                    </span>

                    {/* Open link */}
                    {job.url && (
                      <a
                        href={job.url}
                        className="p-1 text-muted hover:text-white transition-colors flex-shrink-0"
                        onClick={(e) => { e.preventDefault(); window.open(job.url) }}
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer actions */}
              {jobs.filter((j) => j.email).length > 0 && (
                <div className="px-5 py-3 border-t border-border flex-shrink-0">
                  <button
                    onClick={() => {
                      setChecked(new Set(jobs.reduce<number[]>((acc, j, i) => j.email ? [...acc, i] : acc, [])))
                    }}
                    className="text-xs text-accent hover:text-white transition-colors"
                  >
                    Select all with email ({jobsWithEmail})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bulk approval modal */}
      {bulkPlan && (
        <BulkApprovalModal items={bulkPlan} onClose={() => setBulkPlan(null)} />
      )}
    </div>
  )
}
