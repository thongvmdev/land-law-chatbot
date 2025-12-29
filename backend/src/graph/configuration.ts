/**
 * Agent configuration for the Land Law Agentic Workflow.
 *
 * This module defines the configurable parameters for the land law agent,
 * including model selections and Vietnamese prompt templates.
 */

import { RunnableConfig } from '@langchain/core/runnables'
import { z } from 'zod'
import { BaseConfigurationSchema } from '../configuration'

/**
 * Schema for document grading
 */
export const GraderSchema = z.object({
  is_relevant: z
    .boolean()
    .describe(
      'Tài liệu có liên quan đến câu hỏi không? true = có, false = không',
    ),
})

export type Grader = z.infer<typeof GraderSchema>

/**
 * Schema for query routing
 */
export const RouteSchema = z.object({
  is_complex: z
    .boolean()
    .describe(
      'Is this a complex question requiring multiple sub-queries? ' +
        'Complex questions typically: ' +
        '1) Ask about multiple articles/chapters, ' +
        '2) Compare different concepts, ' +
        '3) Require multi-step reasoning, ' +
        '4) Combine multiple legal aspects',
    ),
  reasoning: z
    .string()
    .describe('Brief explanation of why the question is simple or complex'),
})

export type Route = z.infer<typeof RouteSchema>

/**
 * Schema for query decomposition
 */
export const DecompositionSchema = z.object({
  sub_queries: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      'List of 2-4 focused sub-queries that together cover the original question',
    ),
})

export type Decomposition = z.infer<typeof DecompositionSchema>

/**
 * LandLawAgentConfiguration extends BaseConfiguration with agent-specific settings
 */
export const LandLawAgentConfigurationSchema = BaseConfigurationSchema.extend({
  /**
   * The language model used for metadata extraction and query processing.
   * Should be in the form: provider/model-name.
   * @default "groq/llama-3.1-8b-instant"
   */
  queryModel: z
    .string()
    .default('groq/qwen3-32b') // qwen3:8b
    .describe(
      'The language model used for query processing and metadata extraction',
    ),

  /**
   * The language model used for generating final responses.
   * Should be in the form: provider/model-name.
   * @default "groq/llama-3.1-8b-instant"
   */
  responseModel: z
    .string()
    .default('groq/llama-3.1-8b-instant') // qwen3:8b, openai/gpt-4.1-mini
    .describe('The language model used for generating responses'),

  /**
   * Maximum number of query transformation retries
   * @default 2
   */
  maxRetries: z
    .number()
    .min(0)
    .max(5)
    .default(2)
    .describe('Maximum number of query transformation attempts'),

  /**
   * Temperature for query processing models
   * @default 0
   */
  queryTemperature: z
    .number()
    .min(0)
    .max(2)
    .default(0)
    .describe('Temperature for query processing (0 = deterministic)'),

  /**
   * Temperature for response generation
   * @default 0.3
   */
  responseTemperature: z
    .number()
    .min(0)
    .max(2)
    .default(0.3)
    .describe('Temperature for response generation (higher = more creative)'),

  /**
   * Minimum score threshold for document relevance
   * Documents below this score are filtered out
   * @default 0.6
   */
  scoreThreshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.6)
    .describe('Minimum hybrid search score for document relevance'),

  /**
   * Minimum number of documents to keep regardless of score
   * Prevents zero results when all scores are low
   * @default 2
   */
  minDocuments: z
    .number()
    .min(0)
    .default(2)
    .describe('Minimum documents to keep regardless of threshold'),

  /**
   * Maximum number of sub-queries for decomposition
   * @default 3
   */
  maxSubQueries: z
    .number()
    .min(2)
    .max(5)
    .default(3)
    .describe('Maximum sub-queries for complex questions'),

  /**
   * Documents to retrieve per sub-query
   * Should be lower than single query limit for efficiency
   * @default 4
   */
  docsPerSubQuery: z
    .number()
    .min(2)
    .max(10)
    .default(4)
    .describe('Documents to retrieve per sub-query in parallel retrieval'),
})

export type LandLawAgentConfiguration = z.infer<
  typeof LandLawAgentConfigurationSchema
>

/**
 * Extract land law agent configuration from RunnableConfig
 *
 * Reads from config.configurable to match LangGraph conventions
 */
export function getLandLawAgentConfiguration(
  config?: RunnableConfig,
): LandLawAgentConfiguration {
  const configurable = config?.configurable || {}

  // Convert snake_case to camelCase for all fields
  const camelCased: Record<string, any> = {}

  for (const [key, value] of Object.entries(configurable)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
      letter.toUpperCase(),
    )
    camelCased[camelKey] = value
  }

  // Parse and validate with defaults
  return LandLawAgentConfigurationSchema.parse(camelCased)
}

/**
 * Create a default configuration for testing
 */
export function getDefaultLandLawConfig(): LandLawAgentConfiguration {
  return LandLawAgentConfigurationSchema.parse({})
}
