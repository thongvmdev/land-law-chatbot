import weaviate, { WeaviateClient } from 'weaviate-client'
import { Document } from '@langchain/core/documents'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { BaseMessage } from '@langchain/core/messages'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOpenAI } from '@langchain/openai'
import { ChatGroq } from '@langchain/groq'
import { ChatOllama } from '@langchain/ollama'
import { MetadataKey } from './constants'
import unionBy from 'lodash/unionBy'
import isEmpty from 'lodash/isEmpty'

/**
 * Extract the latest user question from messages array.
 *
 * Searches backwards through the messages array to find the most recent
 * human message and returns its content as the question.
 *
 * @param messages - Array of BaseMessage objects
 * @returns The content of the last human message
 * @throws Error if no human message is found
 *
 * @example
 * ```typescript
 * const messages = [
 *   new HumanMessage("What is Article 152?"),
 *   new AIMessage("Article 152 is about..."),
 *   new HumanMessage("Tell me more")
 * ];
 * const question = extractLatestQuestion(messages);
 * // Returns: "Tell me more"
 * ```
 */
export function extractLatestQuestion(messages: BaseMessage[]): string {
  // Find the last human message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'human') {
      return messages[i].content as string
    }
  }
  throw new Error('No user question found in messages')
}

export async function getWeaviateClient(
  weaviateUrl?: string,
  weaviateGrpcUrl?: string,
  weaviateApiKey?: string,
): Promise<WeaviateClient> {
  const url = weaviateUrl || process.env.WEAVIATE_URL || 'http://weaviate:8080'
  const grpcUrl =
    weaviateGrpcUrl || process.env.WEAVIATE_GRPC_URL || 'weaviate:50051'
  const apiKey = weaviateApiKey || process.env.WEAVIATE_API_KEY || 'admin-key'

  // Detect if we're using local Docker (http://) or cloud (https://)
  // Local indicators: starts with http:// OR doesn't contain dots (service name)
  const isLocalDocker =
    url.startsWith('http://') ||
    (!url.includes('://') && !url.includes('.')) ||
    url.includes('localhost') ||
    url.includes('weaviate:')

  const httpHost = url.replace(/^https?:\/\//, '').split(':')[0]
  const grpcHost = grpcUrl.split(':')[0]

  // Configure connection based on environment
  const httpPort = isLocalDocker ? 8080 : 443
  const httpSecure = !isLocalDocker
  const grpcPort = isLocalDocker ? 50051 : 443
  const grpcSecure = !isLocalDocker

  console.log(
    `🔌 Connecting to Weaviate: ${httpHost}:${httpPort} (secure: ${httpSecure}), gRPC: ${grpcHost}:${grpcPort} (secure: ${grpcSecure})`,
  )

  const client = await weaviate.connectToCustom({
    httpHost,
    httpPort,
    httpSecure,
    grpcHost,
    grpcPort,
    grpcSecure,
    authCredentials: new weaviate.ApiKey(apiKey),
    // Skip init checks for local Docker to avoid health check issues
    skipInitChecks: isLocalDocker,
    // Increase timeouts for slow/tunneled connections
    timeout: {
      init: 60_000, // 60 seconds for initialization
      query: 60_000, // 60 seconds for queries
      insert: 120_000, // 2 minutes for inserts
    },
  })

  return client
}

export function formatDoc(doc: Document): string {
  const metadata = doc.metadata || {}
  const header: string[] = []

  // Add chapter information
  if (metadata.chapter_id && metadata.chapter_title) {
    header.push(`Chương ${metadata.chapter_id}: ${metadata.chapter_title}`)
  }

  // Add section information if available
  if (metadata.section_id && metadata.section_title) {
    header.push(`Mục ${metadata.section_id}: ${metadata.section_title}`)
  }

  const headerStr = header.length > 0 ? header.join('\n') + '\n' : ''

  return `${headerStr}${doc.pageContent}`
}

export function formatDocs(docs: Document[] | null | undefined): string {
  if (!docs || docs.length === 0) {
    return ''
  }
  const formatted = docs.map((doc) => formatDoc(doc)).join('\n\n')
  return `<documents>\n${formatted}\n</documents>`
}

/**
 * Count tokens using character-based estimation
 * Adjusted for Vietnamese text: 1 token ≈ 2.5 characters
 *
 * This is a fast, lightweight method that works well for:
 * - Quick token estimates
 * - Decision-making (e.g., choosing generation strategy)
 * - Vietnamese/Mixed language text
 *
 * @param text - Text to count tokens for
 * @returns Estimated token count
 */
export function countTokens(text: string): number {
  // Vietnamese text tokenizes worse than English for GPT models
  // Average for Vietnamese: ~2.5 characters per token
  return Math.ceil(text.length / 2.5)
}

/**
 * Calculate total tokens for a document including metadata
 * Uses character-based estimation
 *
 * @param doc - Document to count tokens for
 * @returns Estimated token count for formatted document
 */
export function countDocumentTokens(doc: Document): number {
  const formatted = formatDoc(doc)
  return countTokens(formatted)
}

/**
 * Calculate total tokens for an array of documents
 * Uses character-based estimation
 *
 * @param docs - Array of documents to count tokens for
 * @returns Total estimated token count across all documents
 */
export function countTotalDocumentTokens(docs: Document[]): number {
  return docs.reduce((total, doc) => total + countDocumentTokens(doc), 0)
}

/**
 * Load a chat model from a fully specified name.
 *
 * @param fullySpecifiedName - String in the format 'provider/model'
 * @returns A BaseChatModel instance
 *
 * @example
 * ```typescript
 * // Load Groq model
 * const model = loadChatModel("groq/llama-3.3-70b-versatile");
 * // Load other models
 * const model2 = loadChatModel("openai/gpt-4");
 * ```
 */
export function loadChatModel(fullySpecifiedName: string): BaseChatModel {
  let provider: string
  let model: string

  if (fullySpecifiedName.includes('/')) {
    // Split only on the first '/' to handle formats like "groq/openai/gpt-oss-20b"
    // This matches Python's split("/", maxsplit=1) behavior
    const parts = fullySpecifiedName.split('/')
    provider = parts[0]
    model = parts.slice(1).join('/')
  } else {
    provider = ''
    model = fullySpecifiedName
  }

  const baseConfig = {
    temperature: 0,
    cache: true,
  }

  console.log('🚀 ~ model:', model, 'provider:', provider)

  switch (provider.toLowerCase()) {
    case 'groq':
      const modelMapping = {
        'llama-3.1-8b-instant': 'llama-3.1-8b-instant',
        'qwen3-32b': 'qwen/qwen3-32b',
        'gpt-oss-20b': 'openai/gpt-oss-20b',
        compound: 'groq/compound',
      }

      return new ChatGroq({
        model:
          modelMapping[model as keyof typeof modelMapping] ||
          'llama-3.1-8b-instant',
        streaming: true,
        ...baseConfig,
      })

    case 'openai':
      return new ChatOpenAI({
        model,
        ...baseConfig,
        streamUsage: true,
      })

    case 'anthropic':
      return new ChatAnthropic({
        model,
        streaming: true,
        ...baseConfig,
      })

    case 'ollama':
      return new ChatOllama({
        model,
        ...baseConfig,
        streaming: true,
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      })

    default:
      // Default to OpenAI if no provider specified
      return new ChatOpenAI({
        model: fullySpecifiedName,
        ...baseConfig,
        streamUsage: true,
      })
  }
}

export function reduceDocs(
  existing: Document[] = [],
  newDocs: Document[] = [],
): Document[] {
  // case: no valids docs
  if (isEmpty(newDocs)) {
    return []
  }

  // Check if this is a filtering operation:
  // All new doc IDs exist in existing AND fewer docs returned
  const newIds = new Set(newDocs.map((d) => d.id).filter(Boolean))
  const existingIds = new Set(existing.map((d) => d.id).filter(Boolean))

  // If all new doc IDs are in existing, this is filtering → replace
  const allNewInExisting =
    newIds.size > 0 && [...newIds].every((id) => existingIds.has(id))

  if (allNewInExisting) {
    return newDocs // Replace with filtered subset
  }

  // Otherwise, merge with deduplication (parallel retrieval case)
  const combinedByUuid = unionBy(existing, newDocs, (doc) => doc.id)

  return combinedByUuid
}

/**
 * Rough token estimator: 1 token ≈ 4 characters for Vietnamese/English mixed text.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Extract a human-readable topic label from a human message.
 * Prefers explicit article references (e.g. "Điều 152") and falls back
 * to the first 40 chars of the message (more informative than "chủ đề khác").
 */
function extractTopic(content: string): string {
  const articleMatch = content.match(/Điều\s+\d+/)
  if (articleMatch) return articleMatch[0]

  const chapterMatch = content.match(/Chương\s+[IVXLC\d]+/)
  if (chapterMatch) return chapterMatch[0]

  // Strip common question prefixes before taking the excerpt
  const excerpt = content
    .replace(/^(cho tôi biết|hỏi về|giải thích|quy định về)\s*/i, '')
    .slice(0, 40)
    .trim()
  return excerpt || 'câu hỏi khác'
}

/**
 * Formats conversation history as a string for injection into LLM prompts.
 *
 * Strategy:
 * - Walk backwards through Q&A pairs, including the full turn text until
 *   the token budget (maxTokens) is exhausted.
 * - Older messages that exceed the budget are summarised as a compact topic list.
 *
 * @param messages  - Prior messages (should NOT include the current user turn)
 * @param maxTokens - Approximate token budget for the history string (default 1200)
 */
export function formatConversationHistory(
  messages: BaseMessage[],
  maxTokens: number = 1200,
): string {
  if (!messages || messages.length === 0) return ''

  const recentTurns: string[] = []
  const oldTopics: string[] = []
  let usedTokens = 0

  // Walk backwards in Q&A pairs (human at i-1, ai at i)
  for (let i = messages.length - 1; i >= 1; i -= 2) {
    const aiMsg = messages[i]
    const humanMsg = messages[i - 1]
    if (!aiMsg || !humanMsg) continue
    if (aiMsg.type !== 'ai' || humanMsg.type !== 'human') continue

    const humanContent =
      typeof humanMsg.content === 'string'
        ? humanMsg.content
        : JSON.stringify(humanMsg.content)
    const aiContent =
      typeof aiMsg.content === 'string'
        ? aiMsg.content
        : JSON.stringify(aiMsg.content)

    const turn = `👤 Người dùng: ${humanContent}\n🤖 Trợ lý: ${aiContent}`
    const turnTokens = estimateTokens(turn)

    if (usedTokens + turnTokens > maxTokens) {
      // This turn doesn't fit — summarise it and all earlier ones as topics
      oldTopics.unshift(extractTopic(humanContent))
      for (let j = i - 2; j >= 1; j -= 2) {
        const olderHuman = messages[j - 1]
        if (olderHuman?.type === 'human') {
          const olderContent =
            typeof olderHuman.content === 'string'
              ? olderHuman.content
              : JSON.stringify(olderHuman.content)
          oldTopics.unshift(extractTopic(olderContent))
        }
      }
      break
    }

    recentTurns.unshift(turn)
    usedTokens += turnTokens
  }

  const parts: string[] = []

  if (oldTopics.length > 0) {
    const uniqueTopics = [...new Set(oldTopics)]
    parts.push(`[Lịch sử cũ - Đã thảo luận: ${uniqueTopics.join(', ')}]`)
  }

  if (recentTurns.length > 0) {
    parts.push(recentTurns.join('\n\n'))
  }

  return parts.join('\n\n')
}
