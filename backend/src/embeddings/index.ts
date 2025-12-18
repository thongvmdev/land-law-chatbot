/**
 * Embeddings module for managing different embedding providers.
 *
 * Supports:
 * - ollama/nomic-embed-text: Local Ollama embeddings with 2K context window
 * - openai/*: OpenAI embeddings
 * - cloudflare/*: Cloudflare Workers AI embeddings
 * - weaviate/*: Legacy Weaviate built-in vectorizer (deprecated)
 */

import { Embeddings } from '@langchain/core/embeddings'
import { OpenAIEmbeddings } from '@langchain/openai'
import { OllamaEmbeddings } from '@langchain/ollama'
import { OLLAMA_BASE_URL } from '../constants.js'

/**
 * Get embeddings model based on provider and model name.
 *
 * @param model - Model specification in format "provider/model-name"
 * @param baseUrl - Base URL for Ollama (optional, defaults to OLLAMA_BASE_URL)
 * @param useRateLimiting - Whether to use rate-limited wrapper for Google embeddings (default: true)
 * @returns Embeddings instance or null for Weaviate built-in vectorizer
 */
export function getEmbeddingsModel(
  model?: string,
  baseUrl: string = OLLAMA_BASE_URL,
): Embeddings | null {
  const ollamaApiKey = process.env.OLLAMA_API_KEY || ''
  const modelSpec = model || process.env.EMBEDDING_MODEL

  const [provider, modelName] = modelSpec?.split('/', 2) || []
  console.log('  - provider:', { provider, modelName, baseUrl })

  switch (provider.toLowerCase()) {
    case 'ollama':
      return new OllamaEmbeddings({
        model: modelName,
        baseUrl,
        headers: {
          'X-API-Key': ollamaApiKey,
        },
        dimensions: 768,
      })

    case 'openai':
      return new OpenAIEmbeddings({
        model: modelName,
        batchSize: 200,
      })

    case 'weaviate':
      // Weaviate's built-in vectorizer handles embeddings internally
      // Return null to signal that no external embedding is needed
      return null

    default:
      console.error('❌ Unsupported embedding provider:', provider)
      throw new Error(`Unsupported embedding provider: ${provider}`)
  }
}
