/**
 * Graph Node Functions
 *
 * This module contains all node functions for the Land Law Agentic Workflow Graph.
 * Each node function processes the agent state and returns a partial state update.
 */

import { RunnableConfig } from '@langchain/core/runnables'
import { Document } from '@langchain/core/documents'
import { BaseMessage, AIMessage } from '@langchain/core/messages'
import { AgentStateType, QueryInput } from '../state.js'
import {
  getLandLawAgentConfiguration,
  RouteSchema,
  DecompositionSchema,
  PartialAnswerSchema,
  PartialAnswer,
  LandLawRelevanceSchema,
} from '../configuration.js'
import { PROMPTS } from '../prompts.js'
import {
  loadChatModel,
  formatDocs,
  extractLatestQuestion,
  formatConversationHistory,
  countTotalDocumentTokens,
  countDocumentTokens,
  formatDoc,
} from '../../utils.js'
import { getWeaviateVectorStore } from '../retrieval'
import { HybridOptions } from 'weaviate-client'
import { getBaseConfiguration } from '../../configuration.js'

/**
 * NODE 0: Check Land Law Relevance
 *
 * Checks if the user's question is related to Vietnamese Land Law.
 * If not related, returns a message asking the user to re-enter their question.
 */
export async function checkLandLawRelevance(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---CHECK LAND LAW RELEVANCE---')
  const { messages } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  const model = loadChatModel(agentConfig.queryModel)
  const checker = model.withStructuredOutput(LandLawRelevanceSchema, {
    name: 'check_land_law_relevance',
  })

  // Extract question from messages
  const question = extractLatestQuestion(messages)
  const systemPrompt = await PROMPTS.CHECK_LAND_LAW_RELEVANCE.formatMessages({
    question,
  })
  const result = await checker.invoke(systemPrompt, config)

  console.log(`💭 Reasoning: ${result.reasoning}`)
  console.log(`✅ Is related to Land Law: ${result.is_related_to_land_law}`)

  return {
    isRelatedToLandLaw: result.is_related_to_land_law,
    question,
  }
}

/**
 * NODE: Reject Question
 *
 * Generates a polite response asking the user to enter a question
 * related to Vietnamese Land Law 2024.
 */
export async function rejectQuestion(
  state: AgentStateType,
  _config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---REJECT QUESTION---')
  const { messages } = state

  // Extract question from messages (use cached state.question if available)
  const question = state.question || extractLatestQuestion(messages)

  // Format rejection prompt - returns array of BaseMessage objects
  const formattedMessages = await PROMPTS.REJECT_QUESTION.formatMessages({
    question,
  })

  const generation = formattedMessages[0].content as string

  console.log('⚠️ Question rejected - not related to Land Law')

  return {
    messages: formattedMessages,
    answer: generation,
  }
}

/**
 * NODE 1: Route Query
 *
 * Classifies the question as simple or complex.
 * Complex questions will be decomposed into multiple focused queries.
 */
export async function routeQuery(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---ROUTE QUERY---')
  const { messages } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  const model = loadChatModel(agentConfig.queryModel)
  const router = model.withStructuredOutput(RouteSchema, {
    name: 'route_query_complexity',
  })

  // Extract question from messages
  const question = extractLatestQuestion(messages)
  const systemPrompt = await PROMPTS.ROUTE_QUERY.formatMessages({ question })
  const result = await router.invoke(systemPrompt, config)

  console.log(`💭 Reasoning: ${result.reasoning}`)

  return {
    isComplex: result.is_complex,
    question,
  }
}

/**
 * NODE 2: Decompose Query
 *
 * Breaks a complex question into multiple focused sub-queries
 * for more accurate parallel retrieval.
 */
export async function decomposeQuery(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---DECOMPOSE QUERY---')
  const { messages } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  // Extract question from messages (use cached state.question if available)
  const question = state.question || extractLatestQuestion(messages)

  const model = loadChatModel(agentConfig.queryModel)
  const decomposer = model.withStructuredOutput(DecompositionSchema, {
    name: 'decompose_query',
  })

  const systemPrompt = await PROMPTS.DECOMPOSE_QUERY.formatMessages({
    question,
  })
  const result = await decomposer.invoke(systemPrompt, config)

  // Limit to maxSubQueries
  const subQueries = result.sub_queries.slice(0, agentConfig.maxSubQueries)

  console.log(`📝 Decomposed into ${subQueries.length} sub-queries:`)
  subQueries.forEach((q, i) => {
    console.log(`  ${i + 1}. ${q}`)
  })

  return {
    queries: subQueries,
  }
}

/**
 * NODE 3: Retrieve Documents (Single Query)
 *
 * Retrieves documents for a single query.
 * This node is executed in parallel when multiple queries exist.
 * Returns documents that are merged via AgentState.documents reducer.
 */
export async function retrieveDocuments(
  state: QueryInput,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log(`---RETRIEVE (Query ${state.queryIndex + 1})---`)
  const { query, queryIndex } = state
  const baseConfiguration = getBaseConfiguration(config)
  const agentConfig = getLandLawAgentConfiguration(config)
  const vectorStore = await getWeaviateVectorStore(baseConfiguration)

  // Use docsPerSubQuery if this is part of parallel retrieval
  const limit =
    agentConfig.docsPerSubQuery || baseConfiguration.searchKwargs.limit

  const documents = await vectorStore.hybridSearch(query, {
    limit,
    verbose: baseConfiguration.searchKwargs.verbose,
    alpha: baseConfiguration.searchKwargs.alpha,
    returnMetadata: baseConfiguration.searchKwargs.returnMetadata,
    fusionType: baseConfiguration.searchKwargs.fusionType,
  } as HybridOptions<undefined, undefined, undefined>)

  // Add queryIndex to metadata for tracking
  documents.forEach((doc) => {
    doc.metadata = { ...doc.metadata, queryIndex }
  })

  console.log(
    `  ✓ Retrieved ${documents.length} documents for query ${queryIndex + 1}`,
  )

  return {
    documents,
  }
}

/**
 * NODE 4: Grade and Rank Documents
 *
 * Filters and ranks documents based on Weaviate's hybrid search score.
 * Much faster and more cost-effective than LLM-based grading.
 * Handles documents from parallel retrievals by merging and ranking.
 */
export async function gradeDocuments(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---GRADE & RANK DOCUMENTS (SCORE-BASED)---')
  const { documents } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  // Get threshold and minimum documents from config
  const scoreThreshold = agentConfig.scoreThreshold ?? 0.5

  if (!documents || documents.length === 0) {
    console.log('⚠️ No documents to grade')
    return {
      documents: [],
    }
  }

  console.log(`📚 Total documents from retrieval: ${documents.length}`)

  const validDocs = []

  // Grade documents based on their Weaviate hybrid search scores
  for (const doc of documents) {
    const score = doc.metadata?.score as number | undefined

    if (score === undefined) {
      // If score is missing, log warning but keep document as fallback
      console.log('⚠️ Document missing score - keeping by default')
      validDocs.push(doc)
      continue
    }

    if (score >= scoreThreshold) {
      console.log(`✅ Document Relevant (score: ${score.toFixed(4)})`)
      validDocs.push(doc)
    } else {
      console.log(`❌ Document Below Threshold (score: ${score.toFixed(4)})`)
    }
  }

  // Sort valid documents by score (highest first) for better context ordering
  validDocs.sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0))

  console.log(
    `📊 ${validDocs.length}/${documents.length} documents passed (threshold: ${scoreThreshold})`,
  )

  return {
    documents: validDocs,
  }
}

/**
 * NODE 5: Transform Query
 *
 * Rewrites the user's question using legal terminology and
 * optimization strategies to improve retrieval in the next iteration.
 */
export async function transformQuery(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---TRANSFORM QUERY---')
  const { messages, loop_step } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  // Extract question from messages (use cached state.question if available)
  const question = state.question || extractLatestQuestion(messages)

  // Load model for query transformation
  const model = loadChatModel(agentConfig.queryModel)

  // Format prompt for transformation
  const systemPrompt = await PROMPTS.QUERY_TRANSFORM.formatMessages({
    question,
  })
  const response = await model.invoke(systemPrompt, config)
  const betterQuestion =
    typeof response.content === 'string' ? response.content : question

  console.log(`🔄 Original: ${question}`)
  console.log(`🔄 Transformed: ${betterQuestion}`)

  return {
    question: betterQuestion,
    loop_step: loop_step + 1,
    isComplex: false,
    queries: [],
  }
}

/**
 * NODE 6A: Generate Answer - Standard Single Pass
 *
 * Generates the final answer based on the retrieved and graded documents.
 * Uses the response model with higher temperature for natural language.
 * Used when document count and token count are within acceptable limits.
 */
export async function generateStandard(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---GENERATE (STANDARD)---')
  const { messages: stateMessages, documents } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  // Extract question from messages (use cached state.question if available)
  const question = state.question || extractLatestQuestion(stateMessages)

  // Format documents as context
  const context = formatDocs(documents)

  // Load response model
  const model = loadChatModel(agentConfig.responseModel)

  // TODO: Research more detail
  const conversationHistory = formatConversationHistory(
    stateMessages.slice(0, -1), // Exclude current question
  )

  // Format prompt for generation
  const messages = await PROMPTS.GENERATION.formatMessages({
    context,
    question,
    history:
      conversationHistory ||
      'Chưa có lịch sử hội thoại (đây là câu hỏi đầu tiên).',
  })

  const response = await model.invoke(messages, config)

  const generation =
    typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)

  console.log('✅ Answer Generated (Standard)')

  console.log('🔍 Usage Metadata:', {
    ...response.usage_metadata,
  })

  return {
    messages: [response],
    answer: generation || 'No answer generated',
  }
}

/**
 * NODE 6B: Map Phase - Generate partial answer from single document
 *
 * Processes a single document to extract relevant information.
 * Returns structured output with relevance check and partial answer.
 */
export async function mapDocumentToAnswer(
  doc: Document,
  question: string,
  config?: RunnableConfig,
): Promise<PartialAnswer> {
  const agentConfig = getLandLawAgentConfiguration(config)
  const model = loadChatModel(agentConfig.responseModel)

  // Bind structured output schema
  const structuredModel = model.withStructuredOutput(PartialAnswerSchema, {
    name: 'map_document_answer',
  })

  const formattedDoc = formatDoc(doc)
  const messages = await PROMPTS.MAP_DOCUMENT.formatMessages({
    document: formattedDoc,
    question,
  })

  const result = await structuredModel.invoke(messages, config)

  // Log processing
  const articleId = doc.metadata?.article_id || 'Unknown'
  if (result.has_answer) {
    console.log(
      `  ✅ Relevant doc: ${articleId} (${result.source_reference || 'N/A'})`,
    )
  } else {
    console.log(`  ⏭️  Skipped: ${articleId}`)
  }

  return result
}

/**
 * NODE 6C: Reduce Phase - Synthesize partial answers into final response
 *
 * Combines all partial answers from relevant documents into a coherent response.
 */
export async function reducePartialAnswers(
  partialAnswers: PartialAnswer[],
  question: string,
  conversationHistory: string,
  config?: RunnableConfig,
): Promise<BaseMessage> {
  const agentConfig = getLandLawAgentConfiguration(config)
  const model = loadChatModel(agentConfig.responseModel)

  // Format partial answers with references
  const formattedAnswers = partialAnswers
    .map((answer, idx) => {
      const ref = answer.source_reference || `Nguồn ${idx + 1}`
      return `[${ref}]\n${answer.partial_answer}`
    })
    .join('\n\n---\n\n')

  const messages = await PROMPTS.REDUCE_ANSWERS.formatMessages({
    question,
    partial_answers: formattedAnswers,
    history:
      conversationHistory ||
      'Chưa có lịch sử hội thoại (đây là câu hỏi đầu tiên).',
  })

  const response = await model.invoke(messages, config)

  return response
}

/**
 * NODE 6D: Generate Answer - Map-Reduce Strategy
 *
 * Uses Map-Reduce pattern for large document sets:
 * 1. Map: Process each document individually to extract relevant info
 * 2. Reduce: Synthesize all partial answers into final response
 *
 * This approach handles token limits better for large document sets.
 */
export async function generateMapReduce(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---GENERATE (MAP-REDUCE)---')
  const { messages: stateMessages, documents } = state

  // Extract question from messages (use cached state.question if available)
  const question = state.question || extractLatestQuestion(stateMessages)

  // MAP PHASE: Process each document in parallel
  console.log(
    `🗺️  Map phase: Processing ${documents.length} documents in parallel...`,
  )

  const partialAnswerPromises = documents.map((doc) =>
    mapDocumentToAnswer(doc, question, config),
  )

  const allPartialAnswers = await Promise.all(partialAnswerPromises)

  // Filter to keep only relevant answers
  const relevantAnswers = allPartialAnswers.filter(
    (answer) => answer.has_answer && answer.partial_answer.trim().length > 0,
  )

  console.log(
    `📊 Relevant documents: ${relevantAnswers.length}/${documents.length}`,
  )

  // Handle case where no relevant documents found
  if (relevantAnswers.length === 0) {
    console.log('⚠️ No relevant information found in documents')
    return {
      answer:
        'Xin lỗi, tôi không tìm thấy thông tin liên quan trong cơ sở dữ liệu để trả lời câu hỏi của bạn.',
      messages: [],
    }
  }

  // REDUCE PHASE: Synthesize final answer
  console.log('🔄 Reduce phase: Synthesizing final answer...')

  const conversationHistory = formatConversationHistory(
    stateMessages.slice(0, -1),
  )

  const finalAnswer = await reducePartialAnswers(
    relevantAnswers,
    question,
    conversationHistory,
    config,
  )

  console.log(
    `✅ Map-Reduce complete (${documents.length} → ${relevantAnswers.length} → 1)`,
  )

  const generation =
    typeof finalAnswer.content === 'string'
      ? finalAnswer.content
      : JSON.stringify(finalAnswer.content)

  console.log('✅ Answer Generated (Standard)')

  return {
    messages: [finalAnswer],
    answer: generation || 'No answer generated',
  }
}

/**
 * NODE 6: Generate Answer - Hybrid Strategy
 *
 * Intelligently selects between standard single-pass and Map-Reduce based on:
 * - Total document count
 * - Total token count
 * - Presence of large individual documents
 */
export async function generate(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  const { documents } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  // Calculate metrics
  const docCount = documents.length
  const totalTokens = countTotalDocumentTokens(documents)
  const hasLargeDoc = documents.some(
    (doc) => countDocumentTokens(doc) > agentConfig.largeDocTokenThreshold,
  )

  console.log('📊 Document Metrics:', {
    count: docCount,
    totalTokens,
    hasLargeDoc,
    avgTokensPerDoc: Math.round(totalTokens / docCount),
  })

  // DECISION LOGIC: Choose strategy
  const useMapReduce =
    docCount > agentConfig.mapReduceDocThreshold ||
    totalTokens > agentConfig.maxContextTokens ||
    (hasLargeDoc && docCount > 4)

  if (useMapReduce) {
    console.log('→ Strategy: MAP-REDUCE (large document set)')
    return await generateMapReduce(state, config)
  } else {
    console.log('→ Strategy: STANDARD (single pass)')
    return await generateStandard(state, config)
  }
}

/**
 * NODE 7: Generate No Answer
 *
 * Generates a helpful "no answer" response when the system
 * cannot find relevant information after all retries.
 */
export async function generateNoAnswer(
  state: AgentStateType,
  _config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---GENERATE NO ANSWER---')
  const { messages } = state

  // Extract question from messages (use cached state.question if available)
  const question = state.question || extractLatestQuestion(messages)

  // Format no answer prompt
  const formattedMessages = await PROMPTS.NO_ANSWER.formatMessages({ question })

  const generation = formattedMessages[0].content as string

  console.log('⚠️ No Answer Generated')

  return {
    messages: formattedMessages,
    answer: generation,
  }
}
