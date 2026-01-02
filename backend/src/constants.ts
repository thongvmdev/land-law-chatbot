/**
 * Application constants
 */

import { ParsedChunkMetadata } from './ingest/ingest'

// Weaviate index names
export const WEAVIATE_DOCS_INDEX_NAME =
  'LangChain_Combined_Docs_nomic_embed_text'
export const WEAVIATE_GENERAL_GUIDES_AND_TUTORIALS_INDEX_NAME =
  'LangChain_General_Guides_And_Tutorials_nomic_embed_text'

// Google embeddings index names (3072 dimensions)
export const WEAVIATE_DOCS_INDEX_NAME_GOOGLE =
  'LangChain_Combined_Docs_google_gemini_embedding_001'
export const WEAVIATE_GENERAL_LAND_LAW_VN = 'LandLaw2024Vn'

// Ollama configuration
export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || 'https://ollama.hanu-nus.com'
// 'http://localhost:11434'

export const OLLAMA_BASE_EMBEDDING_DOCS_URL =
  process.env.OLLAMA_BASE_EMBEDDING_DOCS_URL || 'http://localhost:11434'

export type MetadataKey = ParsedChunkMetadata & {
  title: string
  source: string
}

export const METADATA_KEYS: (keyof MetadataKey)[] = [
  'source',
  'title',
  'article_id',
  'chapter_id',
  'chapter_title',
  'section_id',
  'section_title',
  'chunk_footnotes',
  'topic',
  'chunk_id',
]

// Graph node names
export const GRAPH_NODES = {
  CHECK_RELEVANCE: 'check_relevance',
  ROUTE_QUERY: 'route_query',
  DECOMPOSE_QUERY: 'decompose_query',
  RETRIEVE_DOCUMENTS: 'retrieve_documents',
  GRADE_DOCUMENTS: 'grade_documents',
  TRANSFORM_QUERY: 'transform_query',
  GENERATE: 'generate',
  NO_ANSWER: 'no_answer',
  REJECT_QUESTION: 'reject_question',
} as const
