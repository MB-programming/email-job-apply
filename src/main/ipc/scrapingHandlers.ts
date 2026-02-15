import { ipcMain } from 'electron'
import {
  scrapeLinkedIn,
  scrapeIndeed,
  scrapeXING,
  scrapeStepStone,
  scrapeKarriere,
  extractEmailFromJobPage
} from '../services/scrapingService'
import type { ScrapingSource } from '../services/scrapingService'

export function registerScrapingHandlers(): void {
  ipcMain.handle(
    'scraping:search',
    async (
      event,
      params: {
        keyword: string
        location: string
        maxResults: number
        sources: string[]
      }
    ) => {
      const { keyword, location, maxResults } = params
      const sources = params.sources as ScrapingSource[]
      const allResults: unknown[] = []
      const perSource = Math.max(Math.ceil(maxResults / sources.length), 5)

      const onProgress = (found: number, msg: string) => {
        event.sender.send('scraping:progress', { found: allResults.length + found, msg })
      }

      for (const source of sources) {
        try {
          let results: unknown[] = []
          if (source === 'linkedin') results = await scrapeLinkedIn(keyword, location, perSource, onProgress)
          else if (source === 'indeed') results = await scrapeIndeed(keyword, location, perSource, onProgress)
          else if (source === 'xing') results = await scrapeXING(keyword, location, perSource, onProgress)
          else if (source === 'stepstone') results = await scrapeStepStone(keyword, location, perSource, onProgress)
          else if (source === 'karriere') results = await scrapeKarriere(keyword, location, perSource, onProgress)
          allResults.push(...results)
          event.sender.send('scraping:progress', { found: allResults.length, msg: `${source}: ${results.length} found` })
        } catch (err) {
          console.error(`Scraping error for ${source}:`, err)
        }
      }

      return allResults.slice(0, maxResults)
    }
  )

  ipcMain.handle('scraping:extract-email', async (_, url: string) => {
    return extractEmailFromJobPage(url)
  })
}
