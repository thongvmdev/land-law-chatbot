/**
 * Application constants
 */

// Weaviate index names
export const WEAVIATE_DOCS_INDEX_NAME =
  'LangChain_Combined_Docs_nomic_embed_text'
export const WEAVIATE_GENERAL_GUIDES_AND_TUTORIALS_INDEX_NAME =
  'LangChain_General_Guides_And_Tutorials_nomic_embed_text'

// Google embeddings index names (3072 dimensions)
export const WEAVIATE_DOCS_INDEX_NAME_GOOGLE =
  'LangChain_Combined_Docs_google_gemini_embedding_001'
export const WEAVIATE_GENERAL_LAND_LAW_VN = 'WEAVIATE_GENERAL_LAND_LAW_VN'

// Ollama configuration
export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || 'https://ollama.hanu-nus.com'

export const OLLAMA_BASE_EMBEDDING_DOCS_URL =
  process.env.OLLAMA_BASE_EMBEDDING_DOCS_URL || 'http://localhost:11434'
