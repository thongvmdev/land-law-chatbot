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
  const url = weaviateUrl || process.env.WEAVIATE_URL || 'weaviate.hanu-nus.com'
  const grpcUrl =
    weaviateGrpcUrl ||
    process.env.WEAVIATE_GRPC_URL ||
    'grpc-weaviate.hanu-nus.com'
  const apiKey = weaviateApiKey || process.env.WEAVIATE_API_KEY || 'admin-key'

  const httpHost = url.replace(/^https?:\/\//, '')
  const grpcHost = grpcUrl.replace(/^https?:\/\//, '')

  const client = await weaviate.connectToCustom({
    httpHost,
    httpPort: 443,
    httpSecure: true,
    grpcHost,
    grpcPort: 443,
    grpcSecure: true,
    authCredentials: new weaviate.ApiKey(apiKey),
    // Skip init checks to avoid gRPC health check failures with proxied/tunneled connections
    skipInitChecks: true,
    // Increase timeouts for slow/tunneled connections
    timeout: {
      init: 60_000, // 60 seconds for initialization
      query: 60_000, // 60 seconds for queries
      insert: 120_000, // 2 minutes for inserts
    },
  })

  return client
}

/**
 * Format a single document as XML.
 *
 * @param doc - The document to format
 * @returns The formatted document as an XML string
 */
function formatDoc(doc: Document): string {
  const metadata = doc.metadata || {}
  const pickFields: (keyof MetadataKey)[] = [
    'title',
    'chapter_title',
    'section_title',
    'chunk_footnotes',
  ]
  const metaStr = Object.entries(metadata)
    .filter(([k]) => pickFields.includes(k as keyof MetadataKey))
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')

  return `<document${metaStr}>\n${doc.pageContent}\n</document>`
}

/**
 * Format a list of documents as XML.
 *
 * This function takes a list of Document objects and formats them into a single XML string.
 *
 * @param docs - A list of Document objects to format, or null
 * @returns A string containing the formatted documents in XML format
 *
 * @example
 * ```typescript
 * const docs = [
 *   new Document({ pageContent: "Hello" }),
 *   new Document({ pageContent: "World" })
 * ];
 * console.log(formatDocs(docs));
 * // Output:
 * // <documents>
 * // <document>
 * // Hello
 * // </document>
 * // <document>
 * // World
 * // </document>
 * // </documents>
 * ```
 */
export function formatDocs(docs: Document[] | null | undefined): string {
  if (!docs || docs.length === 0) {
    return '<documents></documents>'
  }
  const formatted = docs.map((doc) => formatDoc(doc)).join('\n')
  return `<documents>\n${formatted}\n</documents>`
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

// TODO: double check logic later when integrate with FE
export function formatConversationHistory(
  messages: BaseMessage[],
  keepRecentTurns: number = 3,
): string {
  if (!messages || messages.length === 0) {
    return ''
  }

  // Split into old and recent
  const recentCount = keepRecentTurns * 2 // Q&A pairs
  const oldMessages = messages.slice(0, -recentCount)
  const recentMessages = messages.slice(-recentCount)

  let formatted = ''

  // Summarize old messages
  if (oldMessages.length > 0) {
    const topics = oldMessages
      .filter((m) => m.type === 'human')
      .map((m) => {
        const content = typeof m.content === 'string' ? m.content : ''
        // Extract article numbers if mentioned
        const match = content.match(/Điều\s+\d+/)
        return match ? match[0] : 'chủ đề khác'
      })
    formatted += `[Lịch sử cũ - Đã thảo luận: ${[...new Set(topics)].join(
      ', ',
    )}]\n\n`
  }

  // Full recent messages
  if (recentMessages.length > 0) {
    formatted += recentMessages
      .map((msg) => {
        const role = msg.type === 'human' ? '👤 Người dùng' : '🤖 Trợ lý'
        const content =
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content)
        return `${role}: ${content}`
      })
      .join('\n\n')
  }

  return formatted
}
