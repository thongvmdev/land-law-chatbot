/**
 * Base configuration for the agent.
 *
 * This module defines the base configuration parameters for indexing and retrieval operations.
 */

import { RunnableConfig } from '@langchain/core/runnables'
import { z } from 'zod'

/**
 * BaseConfiguration schema using Zod for validation
 */
export const BaseConfigurationSchema = z.object({
  /**
   * Name of the embedding model to use.
   * Must be a valid embedding model name.
   * @default "ollama/qwen3-embedding:0.6b"
   */
  embeddingModel: z
    .string()
    .default('ollama/qwen3-embedding:0.6b')
    .describe('Name of the embedding model to use'),

  embeddingQueryUserModel: z
    .string()
    .default('cloudflare/qwen3-embedding-0.6b')
    .describe('Name of the embedding model to use for query user'),

  /**
   * The vector store provider to use for retrieval.
   * @default "weaviate"
   */
  retrieverProvider: z
    .enum(['weaviate'])
    .default('weaviate')
    .describe('The vector store provider to use for retrieval'),

  /**
   * Additional keyword arguments to pass to the search function of the retriever.
   * Final Score = alpha × normalized_vector_score + (1 - alpha) × normalized_bm25_score
   * The alpha: 0.5 parameter controls the balance:
   * alpha = 0.0 → Pure keyword (BM25) search
   * alpha = 0.5 → Equal weight to both (your current setting)
   * alpha = 1.0 → Pure vector search
   */
  searchKwargs: z
    .record(z.string(), z.any())
    .default({
      limit: 6,
      verbose: true,
      alpha: 0.5,
      returnMetadata: ['score', 'explainScore'],
      fusionType: 'RelativeScore',
    })
    .describe('Additional keyword arguments for the retriever search function'),

  /**
   * The number of documents to retrieve (backwards compatibility).
   * Use searchKwargs instead.
   * @default 6
   */
  k: z.number().default(6).describe('Number of documents to retrieve'),

  /**
   * The type of search to perform.
   * @default "similarity"
   */
  searchType: z
    .enum(['similarity', 'mmr'])
    .default('similarity')
    .describe('The type of search to perform'),
})

export type BaseConfiguration = z.infer<typeof BaseConfigurationSchema>

/**
 * Update configurable parameters for backwards compatibility
 */
function updateConfigurableForBackwardsCompatibility(
  configurable: Record<string, any>,
): Record<string, any> {
  const update: Record<string, any> = {}

  if ('k' in configurable) {
    update.searchKwargs = { k: configurable.k }
  }

  if (Object.keys(update).length > 0) {
    return { ...configurable, ...update }
  }

  return configurable
}

/**
 * Extract configuration from RunnableConfig
 */
export function getBaseConfiguration(
  config?: RunnableConfig,
): BaseConfiguration {
  const configurable = config?.configurable || {}
  const updated = updateConfigurableForBackwardsCompatibility(configurable)

  // Convert snake_case to camelCase for embedding_model
  if ('embedding_model' in updated) {
    updated.embeddingModel = updated.embedding_model
    delete updated.embedding_model
  }
  if ('retriever_provider' in updated) {
    updated.retrieverProvider = updated.retriever_provider
    delete updated.retriever_provider
  }
  if ('search_kwargs' in updated) {
    updated.searchKwargs = updated.search_kwargs
    delete updated.search_kwargs
  }

  // Parse and validate with defaults
  return BaseConfigurationSchema.parse(updated)
}
