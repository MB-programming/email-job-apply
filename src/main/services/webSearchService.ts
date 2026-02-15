import { net } from 'electron'

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

// Fetch a URL using Electron's net module (bypasses CORS, uses system proxy)
function fetchUrl(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url,
      redirect: 'follow'
    })

    const defaultHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,*/*',
      'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
      ...headers
    }

    Object.entries(defaultHeaders).forEach(([k, v]) => request.setHeader(k, v))

    let body = ''
    request.on('response', (response) => {
      response.on('data', (chunk) => { body += chunk.toString() })
      response.on('end', () => resolve(body))
      response.on('error', reject)
    })
    request.on('error', reject)
    request.end()
  })
}

// Strip HTML tags
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

// Parse DuckDuckGo HTML search results
function parseDDG(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = []

  // Split into result blocks
  const blocks = html.split('<div class="result ')
  for (let i = 1; i < blocks.length && results.length < max; i++) {
    const block = blocks[i]

    // Extract URL from result__a href
    const hrefMatch = block.match(/class="result__a"[^>]*href="([^"]+)"/)
    if (!hrefMatch) continue
    const url = hrefMatch[1]
    if (!url.startsWith('http')) continue

    // Extract title
    const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/)
    if (!titleMatch) continue
    const title = stripTags(titleMatch[1])

    // Extract snippet
    const snippetMatch = block.match(/class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/)
    const snippet = snippetMatch ? stripTags(snippetMatch[1]) : ''

    if (title && url) {
      results.push({ title, url, snippet })
    }
  }

  return results
}

// DuckDuckGo HTML search — no API key required
export async function searchWeb(query: string, maxResults = 8): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const html = await fetchUrl(url)
    const results = parseDDG(html, maxResults)

    // Fallback: try to get more if few found
    if (results.length < 3) {
      const url2 = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=at-de`
      const html2 = await fetchUrl(url2)
      const r2 = parseDDG(html2, maxResults)
      return r2.length > results.length ? r2 : results
    }

    return results
  } catch (err) {
    console.error('Web search error:', err)
    return []
  }
}

// Search specifically for companies/businesses
export async function searchCompanies(
  specialization: string,
  location: string,
  count: number
): Promise<SearchResult[]> {
  const queries = [
    `site:linkedin.com/company OR site:xing.com/companies "${specialization}" "${location}"`,
    `"${specialization}" Unternehmen "${location}" Kontakt email Bewerbung`,
    `software development company "${location}" jobs email -IBM -SAP -Microsoft -Amazon`,
    `"${specialization}" Firma Wien Österreich Stellenangebote`,
  ]

  const allResults: SearchResult[] = []
  const seen = new Set<string>()

  for (const q of queries) {
    if (allResults.length >= count) break
    const r = await searchWeb(q, Math.ceil(count / 2))
    for (const item of r) {
      const key = item.url.split('/').slice(0, 3).join('/')
      if (!seen.has(key)) {
        seen.add(key)
        allResults.push(item)
      }
    }
  }

  return allResults.slice(0, count)
}

export { fetchUrl }
