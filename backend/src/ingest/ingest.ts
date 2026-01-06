import 'dotenv/config'

import { promises as fs } from 'fs'
import { PostgresRecordManager } from '@langchain/community/indexes/postgres'
import { getWeaviateClient } from '../utils.js'
import { getEmbeddingsModel } from '../embeddings'
import { OLLAMA_BASE_EMBEDDING_DOCS_URL } from '../constants.js'
import { Document } from '@langchain/core/documents'
import omit from 'lodash/omit'
import {
  createRecordManager,
  createWeaviateVectorStore,
  indexDocumentsInVectorStore,
  logTotalVectorCount,
  writeDocumentsToJsonFile,
} from './utils.js'
import path from 'path'
import { getBaseConfiguration } from '../configuration.js'

const WEAVIATE_URL = process.env.WEAVIATE_URL
const WEAVIATE_GRPC_URL = process.env.WEAVIATE_GRPC_URL
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY
const PARSER_SERVICE_URL =
  process.env.PARSER_SERVICE_URL || 'http://localhost:8001'

/**
 * Interface for parser service response.
 */
interface ParsedChunk {
  page_content: string
  metadata: {
    law_id?: string
    chapter_id?: string | null
    chapter_title?: string | null
    section_id?: string | null
    section_title?: string | null
    article_id: string
    article_title: string
    topic: string
    source: string
    chunk_id: string
    chunk_type: string
    clause_id?: string | null
    point_id?: string | null
    page_number: number[]
    coordinates: Array<Record<string, unknown>>
    chunk_footnotes: string
    has_points?: boolean | null
  }
}

interface ParseResponse {
  success: boolean
  chunks: ParsedChunk[]
  total_chunks: number
  structure: Record<string, unknown>[]
  message: string
}

interface ParseRequest {
  max_pages?: number | null
}

export type ParsedChunkMetadata = ParsedChunk['metadata']

/**
 * Fetch chunks from the Land Law parser service.
 *
 * @param maxPages - Optional maximum number of pages to process
 * @returns Array of LangChain Document objects
 */
export async function fetchLandLawChunksFromParser(
  maxPages?: number | null,
): Promise<{ documents: Document[]; structure: Record<string, unknown>[] }> {
  const url = `${PARSER_SERVICE_URL}/parse-pdf`
  const requestBody: ParseRequest = {}

  if (maxPages !== undefined && maxPages !== null) {
    requestBody.max_pages = maxPages
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Parser service returned ${response.status}: ${errorText}`,
      )
    }

    const data = (await response.json()) as ParseResponse

    if (!data.success) {
      throw new Error(`Parser service returned error: ${data.message}`)
    }

    if (!data.chunks || data.chunks.length === 0) {
      console.warn('Parser service returned no chunks')
      return { documents: [], structure: [] }
    }

    const { structure, chunks } = data

    // Convert parser chunks to LangChain Document format
    const documents = chunks.map((chunk) => {
      // Map parser metadata to LangChain document metadata
      // Ensure required fields (source, title) are present
      const metadata: Record<string, unknown> = omit(
        {
          ...chunk.metadata,
          source: chunk.metadata.source || '133-vbhn-vpqh.pdf',
          title: chunk.metadata.article_title || '',
          coordinates: JSON.stringify(chunk?.metadata?.coordinates || []),
        },
        [
          'article_title',
          'clause_id',
          'point_id',
          'chunk_type',
          'has_points',
        ] as (keyof ParsedChunkMetadata)[],
      )

      // Handle null values that Weaviate filters out
      // Convert null values to empty strings to ensure fields are always present in schema
      const fieldsToPreserve: (keyof ParsedChunkMetadata)[] = [
        'section_id',
        'section_title',
      ]
      fieldsToPreserve.forEach((field) => {
        if (
          chunk.metadata?.[field] === null ||
          chunk.metadata?.[field] === undefined
        ) {
          metadata[field] = '' // Use empty string instead of null
        } else {
          metadata[field] = chunk.metadata?.[field]
        }
      })

      return new Document({
        pageContent: chunk.page_content,
        metadata,
      })
    })

    console.log(`✓ Fetched ${documents.length} chunks from parser service`)

    return { documents, structure }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to fetch chunks from parser service: ${error.message}`,
      )
    }
    throw new Error('Failed to fetch chunks from parser service: Unknown error')
  }
}

/**
 * Main ingestion function.
 * Orchestrates the document ingestion pipeline: load, split, and index documents.
 */
export async function ingestDocs(): Promise<void> {
  console.log('Starting document ingestion...')

  // Initialize embeddings model
  const embedding = getEmbeddingsModel(
    getBaseConfiguration().embeddingModel,
    OLLAMA_BASE_EMBEDDING_DOCS_URL,
  )

  if (!embedding) {
    throw new Error('Embeddings model is required for ingestion')
  }

  // Initialize Weaviate client
  const weaviateClient = await getWeaviateClient()

  let recordManager: PostgresRecordManager | undefined

  try {
    console.log('Fetching documents from parser service...')
    const { documents: chunks, structure } =
      (await fetchLandLawChunksFromParser()) || { documents: [], structure: [] }
    console.log(`✓ Loaded ${chunks.length} documents successfully`)

    console.log('Writing chunks to file...')
    await writeDocumentsToJsonFile(chunks, 'chunks_js_.json', 'chunks')

    console.log('Writing structure to file...')
    await fs.writeFile(
      path.join(process.cwd(), 'data', 'structure_.json'),
      JSON.stringify(structure, null, 2),
      'utf-8',
    )

    const vectorStore = createWeaviateVectorStore(weaviateClient, embedding)
    recordManager = await createRecordManager()

    // Index documents
    await indexDocumentsInVectorStore(chunks, vectorStore, recordManager)

    // Log final count
    await logTotalVectorCount(weaviateClient)

    console.log('Document ingestion completed successfully!')
  } finally {
    // Cleanup connections
    if (recordManager) {
      await recordManager.end()
      console.log('Record manager connection closed')
    }
    await weaviateClient.close()
    console.log('Weaviate client closed')
  }
}
