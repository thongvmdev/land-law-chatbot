/**
 * Playwright loader utilities.
 *
 * Provides functions to load documents from JavaScript-rendered sites using Playwright.
 */

import { PlaywrightWebBaseLoader } from '@langchain/community/document_loaders/web/playwright'
import { RecursiveUrlLoader } from '@langchain/community/document_loaders/web/recursive_url'
import { Document } from '@langchain/core/documents'
import type { CheerioAPI } from 'cheerio'
import { reactDevExtractor, extractMetadata } from '../parser.js'
import { writeFileSync } from 'fs'

/**
 * Options for loading documents with Playwright.
 */
export interface PlaywrightLoaderOptions {
  /** Function to extract content from HTML using cheerio */
  extractor?: (html: string | CheerioAPI) => string
  /** Maximum number of pages to load (for rate limiting) */
  maxPages?: number
  /** Timeout for page load in milliseconds */
  timeout?: number
  /** Wait until option for page load */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit'
  /** Whether to extract metadata from HTML */
  extractMetadata?: boolean
}

/**
 * Load documents from URLs using Playwright (for JavaScript-rendered sites).
 *
 * This function uses PlaywrightWebBaseLoader to load pages with JavaScript
 * execution, then processes the rendered HTML with cheerio extractors.
 * Useful for React, Vue, or other client-side rendered sites.
 *
 * @param urls - Array of URLs to load
 * @param options - PlaywrightLoaderOptions
 * @returns Array of loaded documents with extracted content
 */
export async function loadFromPlaywright(
  urls: string[],
  options: PlaywrightLoaderOptions = {},
): Promise<Document[]> {
  const {
    extractor = reactDevExtractor,
    maxPages,
    timeout = 30000,
    waitUntil = 'networkidle',
    extractMetadata: shouldExtractMetadata = true,
  } = options

  console.log(`Loading ${urls.length} documents with Playwright...`)
  if (maxPages) {
    console.log(`Limiting to ${maxPages} pages`)
  }

  const urlsToLoad = maxPages ? urls.slice(0, maxPages) : urls

  // Process all URLs in parallel
  const documentPromises = urlsToLoad.map(async (url, index) => {
    console.log(`Loading [${index + 1}/${urlsToLoad.length}]: ${url}`)

    // Use PlaywrightWebBaseLoader to get rendered HTML (after JS execution)
    const loader = new PlaywrightWebBaseLoader(url, {
      gotoOptions: {
        timeout,
        waitUntil,
      },
      // Use evaluate to get the full HTML after rendering
      // Wait for React/content to be fully rendered before extracting HTML
      evaluate: async (page) => {
        // Wait for main content to be rendered with actual text
        try {
          await page.waitForSelector('main', { timeout: 10000 })

          await page.waitForFunction(
            () => {
              const main = document.querySelector('main')
              return main && (main.textContent?.trim().length || 0) > 500
            },
            { timeout: 20000 },
          )

          await page
            .waitForFunction(
              () => {
                const hasHeading = document.querySelector('main h1') !== null
                const hasCode =
                  document.querySelector('main pre, main code') !== null
                const main = document.querySelector('main')
                const hasSubstantialText =
                  (main?.textContent?.trim().length || 0) > 1000
                return hasSubstantialText && (hasHeading || hasCode)
              },
              { timeout: 10000 },
            )
            .catch(() => {
              console.log(
                'Optional React.dev content check timed out, continuing...',
              )
            })
        } catch (error) {
          console.warn(
            `Waiting for content failed, using timeout fallback:`,
            error,
          )
          await page.waitForTimeout(5000)
        }

        // Extract text directly from the rendered DOM
        const mainElement = await page.$('main')
        if (mainElement) {
          const text = await mainElement.textContent()
          if (text && text.trim().length > 100) {
            // Return a simple HTML wrapper so the extractor can process it
            // This ensures we get the actual rendered text content
            return `<main>${text
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</main>`
          }
        }

        // Fallback to full HTML
        return await page.content()
      },
    })

    // Load the page - this returns HTML string in pageContent
    const docs = await loader.load()
    // console.log('🚀 ~ documentPromises ~ docs:', docs[0].pageContent)

    if (docs.length === 0 || !docs[0].pageContent) {
      console.warn(`No content extracted from ${url}`)
      return null
    }

    // Process HTML with cheerio extractor
    const html = docs[0].pageContent
    console.log(`📄 Raw HTML length: ${html.length} chars`)
    // Write raw HTML to a JSON file for debugging/output (per page)
    try {
      writeFileSync(
        `playwright_raw_${encodeURIComponent(url)}.json`,
        JSON.stringify({ url, html }, null, 2),
        { encoding: 'utf-8' },
      )
      console.log(
        `📝 Wrote raw HTML for ${url} to playwright_raw_${encodeURIComponent(
          url,
        )}.json`,
      )
    } catch (err) {
      console.warn(`Failed to write raw HTML for ${url}:`, err)
    }

    const extractedText = extractor(html)
    console.log(`📝 Extracted text length: ${extractedText.length} chars`)

    // Fun: Write extracted text to a JSON file for curiosity/debugging
    try {
      const fileName = `playwright_extracted_${encodeURIComponent(url)}.json`
      const funObj = {
        url,
        length: extractedText.length,
        allExtractedText: extractedText,
      }
      writeFileSync(fileName, JSON.stringify(funObj, null, 2), {
        encoding: 'utf-8',
      })
      console.log(`🎉📝 Fun: Wrote extracted content to ${fileName}!`)
    } catch (err) {
      console.warn(`🤡📝 Could not write fun output:`, err)
    }
    // console.log(
    //   `📝 Extracted text preview (first 500 chars): ${extractedText.substring(
    //     0,
    //     500,
    //   )}`,
    // )

    if (!extractedText || extractedText.trim().length === 0) {
      console.warn(`Empty content extracted from ${url}`)
      console.warn(`HTML contains 'main' tag: ${html.includes('<main')}`)
      console.warn(
        `HTML contains 'main' closing tag: ${html.includes('</main>')}`,
      )
      return null
    }

    // Extract metadata from HTML if requested
    let metadata: Record<string, string> = {}
    if (shouldExtractMetadata) {
      metadata = extractMetadata(html)
    }

    console.log(`✓ Processed: ${url} (${extractedText.length} chars)`)

    return new Document({
      pageContent: extractedText,
      metadata: {
        source: url,
        ...docs[0].metadata,
        ...metadata,
      },
    })
  })

  // Wait for all promises to settle (fulfilled or rejected) and filter out failed ones
  const results = await Promise.allSettled(documentPromises)
  console.log('🚀 ~ results:', results)

  // Log errors for rejected promises
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.log(`Failed to load ${urlsToLoad[index]}:`, result.reason)
    }
  })

  // Extract successful documents
  const documents = results
    .filter((result) => result.status === 'fulfilled' && result.value !== null)
    .map(
      (result) => (result as PromiseFulfilledResult<Document | null>).value,
    ) as Document[]

  console.log(`✓ Loaded ${documents.length} documents with Playwright`)
  return documents
}

/**
 * Options for recursive Playwright loading.
 */
export interface PlaywrightRecursiveOptions {
  maxDepth?: number
  excludeDirs?: string[]
  preventOutside?: boolean
  timeout?: number
  extractor?: (html: string | CheerioAPI) => string
  maxPages?: number
}

/**
 * Load documents recursively using Playwright (for JavaScript-rendered sites).
 *
 * First discovers URLs using RecursiveUrlLoader (without content extraction),
 * then loads each URL with PlaywrightWebBaseLoader for proper JS rendering.
 *
 * @param baseUrl - Starting URL for recursive crawling
 * @param options - Options for both URL discovery and Playwright loading
 * @returns Array of loaded documents with extracted content
 */
export async function loadFromPlaywrightRecursive(
  baseUrl: string,
  options: PlaywrightRecursiveOptions = {},
): Promise<Document[]> {
  console.log(`Discovering URLs recursively from: ${baseUrl}`)

  const {
    maxDepth = 3,
    excludeDirs = [],
    preventOutside = true,
    timeout = 15000,
    extractor = reactDevExtractor,
    maxPages,
  } = options

  // Step 1: Discover URLs using RecursiveUrlLoader (just to get URLs)
  const urlLoader = new RecursiveUrlLoader(baseUrl, {
    maxDepth,
    excludeDirs,
    preventOutside,
    timeout,
  })

  console.log('Discovering URLs...')
  const urlDocs = await urlLoader.load()
  const discoveredUrls = urlDocs
    .map((doc) => doc.metadata.source)
    .filter((url) => url.startsWith(baseUrl))

  console.log(`Discovered ${discoveredUrls.length} URLs`)
  console.table(discoveredUrls)

  if (discoveredUrls.length === 0) {
    throw new Error('No URLs discovered! Check your base URL and options.')
  }

  // Step 2: Load each URL with Playwright for proper JS rendering
  return loadFromPlaywright(discoveredUrls, {
    extractor,
    maxPages,
    timeout: timeout * 2, // Give Playwright more time
    waitUntil: 'networkidle',
    extractMetadata: true,
  })
}
