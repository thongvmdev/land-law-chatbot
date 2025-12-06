import * as pdfjsLib from 'pdfjs-dist'
import * as fs from 'fs/promises'
import { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api'

interface PageOffsetMap {
  page: number
  start: number
  end: number
}

interface Coordinate {
  page: number
  rect: [number, number, number, number]
}

interface HierarchyState {
  id: string | null
  title: string | null
}

interface ChunkMetadata {
  law_id: string
  chapter_id: string | null
  chapter_title: string | null
  section_id: string | null
  section_title: string | null
  article_id: string
  article_title: string
  topic: string
  source_file: string
  footnotes: string
  chunk_id: string
  chunk_type: 'full_article' | 'clause' | 'point'
  clause_id: string | null
  point_id: string | null
  page_number: number[]
  coordinates: Coordinate[]
  chunk_footnotes: string
  has_points?: boolean
}

interface Chunk {
  page_content: string
  metadata: ChunkMetadata
}

interface ArticleDict {
  id: string
  title: string
  content: string
  metadata: Partial<ChunkMetadata>
}

export class LandLawChunkerFinal {
  private pdfPath: string
  private maxPages: number | null
  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null
  private lawId: string = '133/VBHN-VPQH'
  private chunks: Chunk[] = []

  // State variables (Hierarchy)
  private currentChapter: HierarchyState = { id: null, title: null }
  private currentSection: HierarchyState = { id: null, title: null }

  // Footnote storage by page: { page_num: "footnote content" }
  private pageFootnotesMap: Map<number, string> = new Map()

  // Offset map from index in full_text to page number
  private pageOffsetMap: PageOffsetMap[] = []

  constructor(pdfPath: string, maxPages: number | null = null) {
    this.pdfPath = pdfPath
    this.maxPages = maxPages
  }

  private async loadPdf(): Promise<void> {
    try {
      const data = await fs.readFile(this.pdfPath)
      const loadingTask = pdfjsLib.getDocument({ data })
      this.pdfDoc = await loadingTask.promise
    } catch (e) {
      throw new Error(`Cannot open PDF file: ${e}`)
    }
  }

  private async getPageContentAndFootnotes(
    pageNum: number,
  ): Promise<{ cleanText: string; footnoteText: string }> {
    if (!this.pdfDoc) throw new Error('PDF not loaded')

    const page = await this.pdfDoc.getPage(pageNum)
    const textContent = await page.getTextContent()

    let cleanText = ''
    let footnoteText = ''

    // Determine font size threshold based on page number
    const totalPages = this.pdfDoc.numPages
    const FONT_SIZE_THRESHOLD = pageNum === totalPages ? 7 : 12

    // Group text items by line (using y-coordinate)
    const lineGroups = new Map<number, TextItem[]>()

    for (const item of textContent.items) {
      if ('str' in item && 'transform' in item) {
        const textItem = item as TextItem
        const y = Math.round(textItem.transform[5]) // y-coordinate

        if (!lineGroups.has(y)) {
          lineGroups.set(y, [])
        }
        lineGroups.get(y)!.push(textItem)
      }
    }

    // Process each line
    for (const [y, items] of Array.from(lineGroups.entries()).sort(
      (a, b) => b[0] - a[0],
    )) {
      let lineClean = ''
      let lineNote = ''

      for (const item of items.sort(
        (a, b) => a.transform[4] - b.transform[4],
      )) {
        const text = item.str
        const fontSize = item.transform[0] // Font size is in transform matrix

        if (fontSize > FONT_SIZE_THRESHOLD) {
          lineClean += text
        } else {
          // Filter out standalone page numbers
          if (!/^\s*\d+\s*$/.test(text)) {
            lineNote += text
          }
        }
      }

      if (lineClean.trim()) {
        cleanText += lineClean + '\n'
      }
      if (lineNote.trim()) {
        footnoteText += lineNote + ' '
      }
    }

    return { cleanText, footnoteText: footnoteText.trim() }
  }

  private logStructureHierarchy(matches: RegExpMatchArray[]): void {
    console.log(`\n🔍 Tìm thấy ${matches.length} điểm đánh dấu cấu trúc.`)
    console.log('='.repeat(60))
    console.log(`${'LOẠI'.padEnd(10)} | ${'CHI TIẾT'.padEnd(50)}`)
    console.log('='.repeat(60))

    let countChuong = 0
    let countMuc = 0
    let countDieu = 0

    for (const m of matches) {
      const marker = m[1]?.trim() || ''
      const title = m[3]?.trim() || ''

      if (marker.startsWith('Chương')) {
        countChuong++
        console.log(`📘 ${marker}: ${title.toUpperCase()}`)
      } else if (marker.startsWith('Mục')) {
        countMuc++
        console.log(`  📂 ${marker}: ${title}`)
      } else if (marker.startsWith('Điều')) {
        countDieu++
        const displayTitle =
          title.length > 50 ? title.substring(0, 50) + '...' : title
        console.log(`    📄 ${marker} ${displayTitle}`)
      }
    }

    console.log('='.repeat(60))
    console.log(
      `📊 THỐNG KÊ: ${countChuong} Chương | ${countMuc} Mục | ${countDieu} Điều`,
    )
    console.log('='.repeat(60) + '\n')
  }

  private cleanTextForEmbedding(text: string): string {
    // Remove page markers
    text = text.replace(/--- PAGE \d+ ---/g, '')
    // Remove standalone page numbers
    text = text.replace(/^\s*\d+\s*$/gm, '')
    text = text.replace(/\s+-\s*\d+\s+-\s*/g, ' ')
    text = text.replace(/\s+\d+\s+(?=\n|$)/g, ' ')

    // Remove standard headers
    text = text.replace(/CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/g, '')
    text = text.replace(/Độc lập - Tự do - Hạnh phúc/g, '')

    // Join single line breaks (preserve double line breaks for paragraphs)
    text = text.replace(/(?<!\n)\n(?!\n)/g, ' ')

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ')

    return text.trim()
  }

  private getPagesFromOffset(startIdx: number, endIdx: number): number[] {
    const pages = new Set<number>()

    for (const pMap of this.pageOffsetMap) {
      // Check intersection
      if (!(endIdx <= pMap.start || startIdx >= pMap.end)) {
        pages.add(pMap.page)
      }
    }

    return Array.from(pages).sort((a, b) => a - b)
  }

  private async getCoordinatesByOffset(
    searchText: string,
    startIdx: number,
    endIdx: number,
  ): Promise<{ pages: number[]; coordinates: Coordinate[] }> {
    if (!searchText || !this.pdfDoc) {
      return { pages: [], coordinates: [] }
    }

    const targetPages = this.getPagesFromOffset(startIdx, endIdx)

    if (targetPages.length === 0) {
      return { pages: [], coordinates: [] }
    }

    const locations: Coordinate[] = []
    const cleanSearchKey = searchText.replace(/\s+/g, ' ').trim()
    const searchPhrase = cleanSearchKey.substring(0, 50)

    for (const pageNum of targetPages) {
      if (pageNum - 1 >= this.pdfDoc.numPages) continue

      const page = await this.pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()

      // Simple text search - find text items that match
      let accumulatedText = ''
      let startFound = false
      const matchedItems: TextItem[] = []

      for (const item of textContent.items) {
        if ('str' in item) {
          const textItem = item as TextItem
          accumulatedText += textItem.str

          if (
            !startFound &&
            accumulatedText.includes(searchPhrase.substring(0, 10))
          ) {
            startFound = true
          }

          if (startFound) {
            matchedItems.push(textItem)

            if (accumulatedText.includes(searchPhrase)) {
              // Found the text, get bounding box
              if (matchedItems.length > 0) {
                const first = matchedItems[0]
                const last = matchedItems[matchedItems.length - 1]

                locations.push({
                  page: pageNum,
                  rect: [
                    Math.round(first.transform[4] * 100) / 100,
                    Math.round(first.transform[5] * 100) / 100,
                    Math.round(last.transform[4] * 100) / 100,
                    Math.round(last.transform[5] * 100) / 100,
                  ],
                })
              }
              break
            }
          }
        }
      }
    }

    return { pages: targetPages, coordinates: locations }
  }

  private lookupFootnotes(pageNumbers: number[]): string {
    const collectedNotes: string[] = []

    for (const p of pageNumbers) {
      const noteContent = this.pageFootnotesMap.get(p)
      if (noteContent) {
        collectedNotes.push(`[Trang ${p}]: ${noteContent}`)
      }
    }

    return collectedNotes.length > 0 ? collectedNotes.join('\n') : ''
  }

  private async recursiveSplit(
    articleDict: ArticleDict,
    baseOffset: number,
  ): Promise<Chunk[]> {
    const fullText = articleDict.content
    const articleTitle = articleDict.title
    const articleId = articleDict.id

    // Find clauses: "1. ", "2. " at start of line
    const clausePattern = /(?:^|\n)(\d+)\.\s/gm
    const matches = Array.from(fullText.matchAll(clausePattern))

    // Split condition: > 5 clauses
    const shouldSplit = matches.length > 5

    if (!shouldSplit) {
      // Case A: Keep full article as one chunk
      const finalDbText = this.cleanTextForEmbedding(
        `${articleTitle} | ${fullText}`,
      )

      const absStart = baseOffset
      const absEnd = baseOffset + fullText.length

      const { pages: pgs, coordinates: coords } =
        await this.getCoordinatesByOffset(
          fullText.substring(0, 100),
          absStart,
          absEnd,
        )

      const footnotesStr = this.lookupFootnotes(pgs)
      const chunkId = `law_${this.lawId}_art_${articleId}`

      return [
        {
          page_content: finalDbText,
          metadata: {
            ...(articleDict.metadata as any),
            chunk_id: chunkId,
            chunk_type: 'full_article',
            clause_id: null,
            point_id: null,
            page_number: pgs,
            coordinates: coords,
            chunk_footnotes: footnotesStr,
          },
        },
      ]
    }

    // Case B: Split into smaller chunks
    const results: Chunk[] = []

    // Extract preamble
    const articlePreamble =
      matches.length > 0
        ? fullText.substring(0, matches[0].index || 0).trim()
        : ''

    // Process each clause
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]
      const clauseId = match[1]
      const start = (match.index || 0) + match[0].length
      const end =
        i + 1 < matches.length
          ? matches[i + 1].index || fullText.length
          : fullText.length
      const clauseContent = fullText.substring(start, end).trim()

      const absStart = baseOffset + start
      const absEnd = baseOffset + end

      // Find points within clause: "a) ", "b) ", "đ) "
      const pointPattern = /(?:^|\n|\s)([a-zđ])\)\s/gm
      const pointMatches = Array.from(clauseContent.matchAll(pointPattern))

      const hasPoints = pointMatches.length > 0
      const shouldSplitPoints = hasPoints && pointMatches.length > 5

      if (!shouldSplitPoints) {
        // Merge: Create clause-level chunk
        const cleanArtPreamble = this.cleanTextForEmbedding(articlePreamble)
        const fullChunkText = `${articleTitle} | ${cleanArtPreamble} | Khoản ${clauseId}: ${clauseContent}`
        const finalDbText = this.cleanTextForEmbedding(fullChunkText)

        const { pages: pgs, coordinates: coords } =
          await this.getCoordinatesByOffset(
            clauseContent.substring(0, 100),
            absStart,
            absEnd,
          )
        const footnotesStr = this.lookupFootnotes(pgs)

        const chunkId = `law_${this.lawId}_art_${articleId}_clause_${clauseId}`
        results.push({
          page_content: finalDbText,
          metadata: {
            ...(articleDict.metadata as any),
            chunk_id: chunkId,
            chunk_type: 'clause',
            clause_id: clauseId,
            point_id: null,
            page_number: pgs,
            coordinates: coords,
            has_points: hasPoints,
            chunk_footnotes: footnotesStr,
          },
        })
      } else {
        // Split: Create point-level chunks
        const clausePreamble = clauseContent
          .substring(0, pointMatches[0].index || 0)
          .trim()
        const cleanClausePreamble = this.cleanTextForEmbedding(clausePreamble)
        const cleanArtPreamble = this.cleanTextForEmbedding(articlePreamble)

        for (let j = 0; j < pointMatches.length; j++) {
          const pMatch = pointMatches[j]
          const pointId = pMatch[1]
          const pStart = (pMatch.index || 0) + pMatch[0].length
          const pEnd =
            j + 1 < pointMatches.length
              ? pointMatches[j + 1].index || clauseContent.length
              : clauseContent.length
          const pointContent = clauseContent.substring(pStart, pEnd).trim()

          const pAbsStart = absStart + pStart
          const pAbsEnd = absStart + pEnd

          const fullChunkText = `${articleTitle} | ${cleanArtPreamble} | Khoản ${clauseId}: ${cleanClausePreamble} | Điểm ${pointId}) ${pointContent}`
          const finalDbText = this.cleanTextForEmbedding(fullChunkText)

          const { pages: pgs, coordinates: coords } =
            await this.getCoordinatesByOffset(
              pointContent.substring(0, 100),
              pAbsStart,
              pAbsEnd,
            )
          const footnotesStr = this.lookupFootnotes(pgs)

          const chunkId = `law_${this.lawId}_art_${articleId}_clause_${clauseId}_point_${pointId}`
          results.push({
            page_content: finalDbText,
            metadata: {
              ...(articleDict.metadata as any),
              chunk_id: chunkId,
              chunk_type: 'point',
              clause_id: clauseId,
              point_id: pointId,
              page_number: pgs,
              coordinates: coords,
              chunk_footnotes: footnotesStr,
            },
          })
        }
      }
    }

    return results
  }

  private extractArticleInfo(rawArticleText: string): {
    artId: string | null
    title: string | null
    body: string | null
    bodyStartRelOffset: number
  } {
    // Extract article number
    const firstLineMatch = rawArticleText.match(/Điều\s+(\d+)/)
    if (!firstLineMatch) {
      return { artId: null, title: null, body: null, bodyStartRelOffset: 0 }
    }

    const artId = firstLineMatch[1]

    // Find "1. " marker to separate title from body
    const clause1Match = rawArticleText.match(/(\n|^)1\.\s/)

    let fullArtTitle = ''
    let contentBody = ''
    let bodyStartRelOffset = 0

    if (clause1Match) {
      // Case A: Article with clauses
      let splitIdx = clause1Match.index || 0
      if (clause1Match[1] === '\n') {
        splitIdx += 1
      }

      const titleSegment = rawArticleText.substring(0, splitIdx).trim()
      fullArtTitle = titleSegment.replace(/\n/g, ' ')
      contentBody = rawArticleText.substring(splitIdx).trim()
      bodyStartRelOffset = splitIdx
    } else {
      // Case B: Article without clauses
      const lines = rawArticleText.split('\n')
      if (lines.length === 0) {
        return { artId, title: '', body: '', bodyStartRelOffset: 0 }
      }

      const titleParts = [lines[0].trim()]
      let bodyStartIdx = 1

      for (let k = 1; k < lines.length; k++) {
        const line = lines[k].trim()
        if (!line) continue

        // If line starts with lowercase -> continuation of title
        if (
          line[0] &&
          line[0].toLowerCase() === line[0] &&
          /[a-zđ]/.test(line[0])
        ) {
          titleParts.push(line)
          bodyStartIdx = k + 1
        } else {
          break
        }
      }

      fullArtTitle = titleParts.join(' ')
      contentBody = lines.slice(bodyStartIdx).join('\n').trim()

      const idx = rawArticleText.indexOf(contentBody)
      if (idx !== -1) {
        bodyStartRelOffset = idx
      }
    }

    fullArtTitle = fullArtTitle.replace(/\s+/g, ' ').trim()

    if (!contentBody) {
      contentBody = fullArtTitle
    }

    return { artId, title: fullArtTitle, body: contentBody, bodyStartRelOffset }
  }

  async process(): Promise<Chunk[]> {
    console.log(`🚀 Bắt đầu xử lý file: ${this.pdfPath}`)

    await this.loadPdf()

    if (!this.pdfDoc) {
      throw new Error('Failed to load PDF')
    }

    const totalPages = this.pdfDoc.numPages
    const pagesToProcess = this.maxPages
      ? Math.min(this.maxPages, totalPages)
      : totalPages

    if (this.maxPages) {
      console.log(`📋 Giới hạn xử lý: ${pagesToProcess}/${totalPages} trang`)
    }

    let fullText = ''
    let currentOffset = 0
    this.pageOffsetMap = []
    console.log(`📄 Đang đọc PDF: Tách nội dung chính và Footnote...`)

    // Read all pages
    for (let i = 1; i <= pagesToProcess; i++) {
      const { cleanText: clean, footnoteText: note } =
        await this.getPageContentAndFootnotes(i)

      const startPos = currentOffset
      const textLen = clean.length + 1
      const endPos = startPos + textLen

      this.pageOffsetMap.push({ page: i, start: startPos, end: endPos })

      fullText += clean + '\n'
      currentOffset = endPos

      if (note) {
        this.pageFootnotesMap.set(i, note)
      }
    }

    console.log(`✓ Đã đọc xong ${pagesToProcess} trang. Đã lưu index Footnote.`)

    // Pattern for structure hierarchy
    const hierarchyPattern =
      /^(Chương\s+[IVXLCDM]+|Mục\s+\d+|Điều\s+(\d+)\.)\s+(.*)/gm
    const matches = Array.from(fullText.matchAll(hierarchyPattern))

    this.logStructureHierarchy(matches as any)
    console.log(`⏳ Bắt đầu xử lý chi tiết...\n`)

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]
      const markerType = match[1]
      const contentTitle = match[3]?.trim() || ''

      // Update state machine
      if (markerType.startsWith('Chương')) {
        const parts = markerType.split(/\s+/)
        const cId = parts.length > 1 ? parts[1] : 'Unknown'
        this.currentChapter = { id: cId, title: contentTitle }
        this.currentSection = { id: null, title: null }
      } else if (markerType.startsWith('Mục')) {
        const parts = markerType.split(/\s+/)
        const sId = parts.length > 1 ? parts[1] : 'Unknown'
        this.currentSection = { id: sId, title: contentTitle }
      } else if (markerType.startsWith('Điều')) {
        const endIdx =
          i + 1 < matches.length
            ? matches[i + 1].index || fullText.length
            : fullText.length
        const articleGlobalStart = match.index || 0

        const rawArticleText = fullText
          .substring(articleGlobalStart, endIdx)
          .trim()
        const {
          artId,
          title: fullArtTitle,
          body: contentBody,
          bodyStartRelOffset,
        } = this.extractArticleInfo(rawArticleText)

        if (!artId) continue

        const meta: Partial<ChunkMetadata> = {
          law_id: this.lawId,
          chapter_id: this.currentChapter.id,
          chapter_title: this.currentChapter.title,
          section_id: this.currentSection.id,
          section_title: this.currentSection.title,
          article_id: artId,
          article_title: fullArtTitle || '',
          topic: 'legal_document',
          source_file: this.pdfPath.split('/').pop() || '',
          footnotes: '',
        }

        const finalBodyOffset = articleGlobalStart + bodyStartRelOffset

        const chunks = await this.recursiveSplit(
          {
            id: artId,
            title: fullArtTitle || '',
            content: contentBody || '',
            metadata: meta,
          },
          finalBodyOffset,
        )

        this.chunks.push(...chunks)
      }
    }

    console.log(
      `\n✅ Hoàn thành! Tổng cộng ${this.chunks.length} chunks được tạo ra.`,
    )
    return this.chunks
  }
}

// Test runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const PDF_FILE = '133-vbhn-vpqh.pdf'

  ;(async () => {
    try {
      const parser = new LandLawChunkerFinal(PDF_FILE)
      const finalData = await parser.process()

      const OUTPUT_FILE = 'land_law_chunks_final.json'
      await fs.writeFile(
        OUTPUT_FILE,
        JSON.stringify(finalData, null, 2),
        'utf-8',
      )

      console.log(`💾 Dữ liệu đã được lưu vào: ${OUTPUT_FILE}`)
    } catch (e) {
      console.error(`❌ Lỗi: ${e}`)
    }
  })()
}
