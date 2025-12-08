import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings'
import fetch from 'node-fetch'

export interface CloudflareEmbeddingsParams extends EmbeddingsParams {
  accountId: string
  apiToken: string
  model?: string
  baseUrl?: string
}

/**
 * Cloudflare Workers AI embeddings implementation.
 * 
 * Uses the Cloudflare Workers AI API to generate embeddings using models like:
 * - @cf/qwen/qwen3-embedding-0.6b
 * 
 * @example
 * ```typescript
 * const embeddings = new CloudflareEmbeddings({
 *   accountId: 'your-account-id',
 *   apiToken: 'your-api-token',
 *   model: '@cf/qwen/qwen3-embedding-0.6b'
 * });
 * 
 * const vectors = await embeddings.embedDocuments(['Hello world']);
 * ```
 */
export class CloudflareEmbeddings extends Embeddings {
  private accountId: string
  private apiToken: string
  private model: string
  private baseUrl: string

  constructor(params: CloudflareEmbeddingsParams) {
    super(params)
    this.accountId = params.accountId
    this.apiToken = params.apiToken
    this.model = params.model || '@cf/qwen/qwen3-embedding-0.6b'
    this.baseUrl = params.baseUrl || 'https://api.cloudflare.com/client/v4'
  }

  /**
   * Generate embeddings for multiple documents.
   * 
   * @param texts - Array of text documents to embed
   * @returns Promise resolving to array of embedding vectors
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embedTexts(texts)
  }

  /**
   * Generate embedding for a single query.
   * 
   * @param text - Query text to embed
   * @returns Promise resolving to embedding vector
   */
  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embedTexts([text])
    return embeddings[0]
  }

  /**
   * Internal method to generate embeddings using Cloudflare Workers AI API.
   * 
   * @param texts - Array of texts to embed
   * @returns Promise resolving to array of embedding vectors
   * @private
   */
  private async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return []
    }

    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/${this.model}`
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: texts,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Cloudflare AI API returned ${response.status}: ${errorText}`
        )
      }

      const data = await response.json() as {
        data?: number[][]
        shape?: number[]
        success?: boolean
        errors?: Array<{ code: number; message: string }>
      }
      
      // Check for API errors
      if (data.errors && data.errors.length > 0) {
        const errorMessages = data.errors.map(e => e.message).join(', ')
        throw new Error(`Cloudflare AI API errors: ${errorMessages}`)
      }

      // Cloudflare returns embeddings in data.data format
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format from Cloudflare AI API')
      }

      // Validate that we got the expected number of embeddings
      if (data.data.length !== texts.length) {
        throw new Error(
          `Expected ${texts.length} embeddings, got ${data.data.length}`
        )
      }

      return data.data
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get embeddings from Cloudflare AI: ${error.message}`)
      }
      throw new Error('Failed to get embeddings from Cloudflare AI: Unknown error')
    }
  }
}
