import { BrowserWindow, ipcMain } from 'electron'

export interface CollectedJob {
  title: string
  company: string
  location: string
  date: string
  description: string
  applyUrl: string
  email: string
  source: string
}

const COLLECTORS: Record<string, (keyword: string, location: string, maxResults: number, senderFn: (job: CollectedJob) => void) => Promise<void>> = {}

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi) || []
  return [...new Set(matches)].filter((e) => {
    const l = e.toLowerCase()
    return !l.includes('noreply') && !l.includes('sentry') && !l.includes('example')
  })
}

// ─── KARRIERE.AT visible scraper ──────────────────────────────────────────────
COLLECTORS['karriere'] = async (keyword, location, maxResults, send) => {
  const win = new BrowserWindow({
    show: true,
    width: 1200,
    height: 800,
    title: `Collecting jobs from Karriere.at — ${keyword}`,
    webPreferences: { javascript: true, nodeIntegration: false, contextIsolation: true }
  })

  const searchUrl = `https://www.karriere.at/jobs?keyword=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}`
  await win.loadURL(searchUrl, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36'
  })
  await wait(3500)

  let collected = 0
  let page = 1

  while (collected < maxResults && !win.isDestroyed()) {
    // Scroll to load dynamic content
    await win.webContents.executeJavaScript('window.scrollTo(0, document.body.scrollHeight)').catch(() => {})
    await wait(1500)

    const jobs = await win.webContents.executeJavaScript(`
      (function() {
        const selectors = ['[data-controller="job-ad-item"]', '.m-jobsListItem', 'article[class*="job"]'];
        let cards = [];
        for (const s of selectors) { cards = Array.from(document.querySelectorAll(s)); if (cards.length > 0) break; }
        return cards.map(card => {
          const get = (sels) => { for (const s of sels) { const el = card.querySelector(s); if (el?.innerText?.trim()) return el.innerText.trim(); } return ''; };
          const linkEl = card.querySelector('a[href*="/jobs/"], a[href*="/job/"]') || card.querySelector('a[href]');
          const dateEl = card.querySelector('[class*="date"], time, [datetime]');
          const descEl = card.querySelector('[class*="desc"], [class*="summary"], [class*="snippet"]');
          return {
            title: get(['h2', 'h3', '[class*="title"]']),
            company: get(['[class*="company"]', '[class*="employer"]']),
            location: get(['[class*="location"]', '[class*="city"]']),
            date: dateEl?.getAttribute('datetime') || dateEl?.innerText?.trim() || '',
            description: descEl?.innerText?.trim() || '',
            url: linkEl?.href || window.location.href,
            email: (() => { const m = card.querySelector('a[href^="mailto:"]'); return m ? m.href.replace('mailto:', '') : ''; })()
          };
        }).filter(j => j.title);
      })()
    `).catch(() => []) as CollectedJob[]

    for (const job of (Array.isArray(jobs) ? jobs : [])) {
      if (collected >= maxResults) break
      send({
        title: job.title,
        company: job.company || 'Unknown',
        location: job.location || location,
        date: job.date || new Date().toLocaleDateString(),
        description: job.description,
        applyUrl: (job as unknown as { url: string }).url || searchUrl,
        email: (job as unknown as { email: string }).email || '',
        source: 'karriere.at'
      })
      collected++
    }

    if (collected >= maxResults) break

    // Try next page
    const nextBtn = await win.webContents.executeJavaScript(`
      (() => { const n = document.querySelector('[aria-label="Next"], [class*="next"], a[href*="page=${page + 1}"]'); return n ? n.href || 'click' : null; })()
    `).catch(() => null)

    if (!nextBtn) break

    if (nextBtn === 'click') {
      await win.webContents.executeJavaScript(`document.querySelector('[aria-label="Next"], [class*="next"]')?.click()`).catch(() => {})
    } else {
      await win.loadURL(nextBtn as string)
    }
    await wait(2500)
    page++
  }

  if (!win.isDestroyed()) win.destroy()
}

// ─── LINKEDIN visible scraper ──────────────────────────────────────────────────
COLLECTORS['linkedin'] = async (keyword, location, maxResults, send) => {
  const win = new BrowserWindow({
    show: true,
    width: 1200,
    height: 800,
    title: `Collecting jobs from LinkedIn — ${keyword}`,
    webPreferences: { javascript: true, nodeIntegration: false, contextIsolation: true }
  })

  const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}`
  await win.loadURL(searchUrl, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36'
  })
  await wait(4000)

  let collected = 0

  for (let scroll = 0; scroll < Math.ceil(maxResults / 5) && collected < maxResults && !win.isDestroyed(); scroll++) {
    await win.webContents.executeJavaScript('window.scrollBy(0, 600)').catch(() => {})
    await wait(1000)

    const jobs = await win.webContents.executeJavaScript(`
      (function() {
        const cards = Array.from(document.querySelectorAll('.base-card, .job-search-card, [data-entity-urn]'));
        return cards.map(card => {
          const t = card.querySelector('.base-search-card__title, h3');
          const c = card.querySelector('.base-search-card__subtitle, h4');
          const l = card.querySelector('.job-search-card__location');
          const a = card.querySelector('a[href*="/jobs/view/"]');
          const date = card.querySelector('time');
          return { title: t?.innerText?.trim() || '', company: c?.innerText?.trim() || '', location: l?.innerText?.trim() || '', url: a?.href || '', date: date?.getAttribute('datetime') || '' };
        }).filter(j => j.title);
      })()
    `).catch(() => []) as { title: string; company: string; location: string; url: string; date: string }[]

    for (const job of (Array.isArray(jobs) ? jobs : [])) {
      if (collected >= maxResults) break
      // Try to get description by opening the job
      let description = ''
      let email = ''
      try {
        await win.loadURL(job.url, { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36' })
        await wait(2000)
        const data = await win.webContents.executeJavaScript(`
          (() => {
            const desc = document.querySelector('.description__text, .show-more-less-html__markup, [class*="description"]');
            const emailMatch = document.body.innerText.match(/[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/i);
            return { description: desc?.innerText?.trim().slice(0, 300) || '', email: emailMatch?.[0] || '' };
          })()
        `).catch(() => ({ description: '', email: '' })) as { description: string; email: string }
        description = data.description
        email = data.email
        await win.loadURL(searchUrl, { userAgent: 'Mozilla/5.0' })
        await wait(2000)
      } catch { /* ignore */ }

      send({ title: job.title, company: job.company, location: job.location || location, date: job.date || new Date().toLocaleDateString(), description, applyUrl: job.url, email, source: 'LinkedIn' })
      collected++
    }
  }

  if (!win.isDestroyed()) win.destroy()
}

// ─── INDEED visible scraper ───────────────────────────────────────────────────
COLLECTORS['indeed'] = async (keyword, location, maxResults, send) => {
  const win = new BrowserWindow({
    show: true, width: 1200, height: 800,
    title: `Collecting jobs from Indeed — ${keyword}`,
    webPreferences: { javascript: true, nodeIntegration: false, contextIsolation: true }
  })

  const searchUrl = `https://at.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=${encodeURIComponent(location)}`
  await win.loadURL(searchUrl, { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36' })
  await wait(3500)

  let collected = 0

  while (collected < maxResults && !win.isDestroyed()) {
    await win.webContents.executeJavaScript('window.scrollTo(0, document.body.scrollHeight)').catch(() => {})
    await wait(1000)

    const jobs = await win.webContents.executeJavaScript(`
      (function() {
        const cards = Array.from(document.querySelectorAll('[data-jk], .job_seen_beacon'));
        return cards.map(card => {
          const get = sels => { for (const s of sels) { const el = card.querySelector(s); if (el?.innerText?.trim()) return el.innerText.trim(); } return ''; };
          const ta = card.querySelector('h2 a, .jobTitle a');
          const dateEl = card.querySelector('[class*="date"], .date');
          const descEl = card.querySelector('[class*="snippet"]');
          return {
            title: get(['h2 a span', '.jobTitle a', 'h2']),
            company: get(['[data-testid="company-name"]', '.companyName']),
            location: get(['[data-testid="job-location"]', '.companyLocation']),
            url: ta?.href || '',
            date: dateEl?.innerText?.trim() || '',
            description: descEl?.innerText?.trim() || ''
          };
        }).filter(j => j.title);
      })()
    `).catch(() => []) as { title: string; company: string; location: string; url: string; date: string; description: string }[]

    for (const job of (Array.isArray(jobs) ? jobs : [])) {
      if (collected >= maxResults) break
      send({ title: job.title, company: job.company || 'Unknown', location: job.location || location, date: job.date || '', description: job.description, applyUrl: job.url ? (job.url.startsWith('http') ? job.url : `https://at.indeed.com${job.url}`) : searchUrl, email: '', source: 'Indeed' })
      collected++
    }

    const nextBtn = await win.webContents.executeJavaScript(`document.querySelector('[aria-label="Next Page"], [data-testid="pagination-page-next"]')?.href || null`).catch(() => null)
    if (!nextBtn || collected >= maxResults) break
    await win.loadURL(nextBtn as string, { userAgent: 'Mozilla/5.0' })
    await wait(3000)
  }

  if (!win.isDestroyed()) win.destroy()
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function collectJobsVisible(
  keyword: string,
  location: string,
  maxResults: number,
  sources: string[],
  onJob: (job: CollectedJob) => void,
  onDone: () => void
): Promise<void> {
  const perSource = Math.max(Math.ceil(maxResults / sources.length), 5)

  for (const source of sources) {
    const fn = COLLECTORS[source.toLowerCase()]
    if (fn) {
      try {
        await fn(keyword, location, perSource, onJob)
      } catch (err) {
        console.error(`Collector error for ${source}:`, err)
      }
    }
  }

  onDone()
}
