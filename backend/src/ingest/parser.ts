/**
 * HTML parsing utilities for document ingestion.
 *
 * This module provides functions to extract text content from HTML documents,
 * with specific handling for LangChain documentation structure.
 */

import * as cheerio from 'cheerio'

/**
 * Extract text content from LangChain documentation HTML.
 *
 * This function extracts the main content from LangChain documentation pages,
 * focusing on the article content and removing unnecessary elements.
 *
 * @param html - HTML string or cheerio instance
 * @returns Extracted text content
 */
export function langchainDocsExtractor(
  html: string | cheerio.CheerioAPI,
): string {
  const $ = typeof html === 'string' ? cheerio.load(html) : html

  // Remove unwanted elements before extraction
  // This matches Python's behavior which uses SoupStrainer to filter during parsing
  // Remove navigation, menus, sidebars, and other non-content elements
  $(
    'script, style, nav, header, footer, iframe, noscript, form, button, ' +
      'aside, [role="navigation"], [role="banner"], [role="complementary"], ' +
      '[class*="sidebar"], [class*="menu"], [class*="nav"], ' +
      '[class*="toc"], [class*="breadcrumb"]',
  ).remove()

  // Try to find the main article content
  let content = ''

  // Look for common content selectors
  const articleSelector = $('article')
  if (articleSelector.length > 0) {
    // Remove any remaining navigation elements inside article
    articleSelector
      .find('nav, [role="navigation"], [class*="sidebar"], [class*="menu"]')
      .remove()
    content = articleSelector.text()
  } else {
    // Fallback to body if no article found
    content = $('body').text()
  }

  // Clean up the text
  return cleanText(content)
}

/**
 * Simple HTML text extractor.
 *
 * This function extracts all text content from HTML, removing all tags
 * and cleaning up whitespace.
 *
 * @param html - HTML string or cheerio instance
 * @returns Extracted text content
 */
export function simpleExtractor(html: string | cheerio.CheerioAPI): string {
  const $ = typeof html === 'string' ? cheerio.load(html) : html

  // 1. Define the "Kill List"
  // We added specific selectors for pagination and "skip" links
  const selectorsToRemove = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg', // Non-text
    'nav',
    'header',
    'footer',
    'aside', // Semantic layout
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]', // ARIA roles
    '[class*="sidebar"]',
    '[class*="menu"]',
    '[class*="toc"]', // Common layout classes
    '.pagination',
    '[class*="pagination"]', // <--- Kills "Previous/Next" links
    'a[href^="#"]', // <--- Kills "Skip to content" anchor links
    '.skip-link',
    'button',
    'form',
  ]

  // Remove these elements globally to be safe
  $(selectorsToRemove.join(', ')).remove()

  // 2. Intelligent Selection Strategy
  let contentObject = null

  // Priority 1: Article (Most specific)
  if ($('article').length > 0) {
    contentObject = $('article')
  }
  // Priority 2: Main (Standard semantic HTML5)
  else if ($('main').length > 0) {
    contentObject = $('main')
  }
  // Priority 3: Specific Content Divs (Common in Docusaurus/Nextra)
  else if ($('.content').length > 0) {
    contentObject = $('.content')
  }
  // Fallback: Body
  else {
    contentObject = $('body')
  }

  // 3. Deep Cleaning within the selected content
  // Sometimes navs/sidebars are nested DEEP inside <main> (e.g., mobile views)
  contentObject.find(selectorsToRemove.join(', ')).remove()

  // 4. Text Extraction
  return cleanText(contentObject.text())
}

/**
 * Improved React.dev extractor with Markdown code blocks and deeper cleaning.
 */
export function reactDevExtractor(html: string | cheerio.CheerioAPI): string {
  const $ = typeof html === 'string' ? cheerio.load(html) : html

  // 1. ISOLATE CONTENT
  // React.dev usually puts the meat in <main>, but sometimes nested deeper.
  let contentObject = $('main').first()
  if (contentObject.length === 0) {
    contentObject = $('article').first()
  }
  if (contentObject.length === 0) {
    contentObject = $('body')
  }

  // 2. PRE-CLEANING (Remove Noise)
  const selectorsToRemove = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'nav',
    'header',
    'footer',
    'aside',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]',
    // React Docs specific noise
    '[class*="sidebar"]',
    '[class*="menu"]',
    '[class*="nav"]',
    '.sp-wrapper', // Sandpack wrapper UI
    '.sp-preview', // The live preview of the code (we only want the code text)
    '.sp-error', // Error overlays
    '[class*="sandpack-"]', // Generic sandpack classes
    'button', // Remove all buttons (usually UI, not content)
    'form',
    // Bottom navigation (Previous/Next Page)
    '[class*="bottom"]',
    '[class*="page-footer"]',
    '[class*="pagination"]',
    'a[href*="next"]', // often classes contain 'next'
    'a[href*="prev"]',
  ]

  // Apply removal within the content object
  contentObject.find(selectorsToRemove.join(', ')).remove()

  // 3. TRANSFORM CODE BLOCKS TO MARKDOWN (Crucial Step)
  // Find all code blocks (usually pre or code)
  contentObject.find('pre').each((_, el) => {
    const codeBlock = $(el)
    // Try to get language class (e.g., language-js)
    const className = codeBlock.attr('class') || ''
    const match = className.match(/language-(\w+)/)
    const lang = match ? match[1] : ''

    // Get the raw text of the code, preserving whitespace
    const codeText = codeBlock.text()

    // Replace the HTML element with a Markdown string
    // We add newlines to ensure it doesn't merge with surrounding text
    codeBlock.replaceWith(`\n\n\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`)
  })

  // 4. CLEAN REMAINING UI ARTIFACTS
  // Sometimes "Download" or "Fork" text is in divs, not buttons.
  // We can try to remove elements that strictly contain only these words.
  contentObject.find('div, span').each((_, el) => {
    const text = $(el).text().trim()
    if (['Download', 'Reset', 'Fork', 'Open in Sandbox'].includes(text)) {
      $(el).remove()
    }
  })

  // 5. EXTRACT AND CLEAN FINAL TEXT
  // We use a modified cleanText that respects the markdown blocks we just made
  return cleanText(contentObject.text())
}

function cleanText(text: string): string {
  return (
    text
      // Replace multiple newlines with a limit (max 2) to preserve paragraph breaks
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      // Replace non-breaking spaces
      .replace(/\u00A0/g, ' ')
      // We do NOT want to collapse all spaces if we have markdown code blocks,
      // but since we used Cheerio text() on the parent, the indentation inside
      // the code blocks might already be messed up unless we protected them.
      // (The replaceWith strategy above protects them structurally, but we must be careful here).

      // Simple approach: Split by line, trim line, join back.
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0) // Remove empty lines
      .join('\n')
  )
}

/**
 * Extract metadata from HTML page.
 *
 * @param html - HTML string or cheerio instance
 * @param titleSuffix - Optional suffix to append to title
 * @returns Metadata object with title, description, and language
 */
export function extractMetadata(
  html: string | cheerio.CheerioAPI,
  titleSuffix?: string,
): Record<string, string> {
  const $ = typeof html === 'string' ? cheerio.load(html) : html

  let title = $('title').text() || ''
  if (titleSuffix) {
    title += titleSuffix
  }

  const description = $('meta[name="description"]').attr('content') || ''
  const language = $('html').attr('lang') || ''

  return {
    title,
    description,
    language,
  }
}
