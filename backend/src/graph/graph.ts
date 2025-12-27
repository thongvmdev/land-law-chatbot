/**
 * Land Law Agentic Workflow Graph
 *
 * This module implements the agentic workflow for answering questions about
 * Vietnamese Land Law (Luật Đất đai 2024) using LangGraph.
 *
 * Workflow:
 * 1. Route query (simple vs complex)
 * 2. Decompose complex queries into sub-queries
 * 3. Retrieve documents in parallel for multiple queries
 * 4. Grade documents based on hybrid search scores
 * 5. Transform query if needed (with retry limit)
 * 6. Generate final answer based on retrieved documents
 */

import { StateGraph, START, END, Send } from '@langchain/langgraph'
import { RunnableConfig } from '@langchain/core/runnables'
import {
  AgentState,
  AgentStateType,
  InputStateAnnotation,
  QueryInput,
} from './state.js'
import {
  getLandLawAgentConfiguration,
  RouteSchema,
  DecompositionSchema,
  LandLawAgentConfigurationSchema,
} from './configuration.js'
import { PROMPTS } from './prompts.js'
import {
  loadChatModel,
  formatDocs,
  extractLatestQuestion,
  formatConversationHistory,
} from '../utils.js'
import { getWeaviateVectorStore } from './retrieval'
import { HybridOptions } from 'weaviate-client'
import { getBaseConfiguration } from '../configuration.js'
import { GRAPH_NODES } from '../constants.js'

/**
 * NODE 1: Route Query
 *
 * Classifies the question as simple or complex.
 * Complex questions will be decomposed into multiple focused queries.
 */
async function routeQuery(
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
async function decomposeQuery(
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
async function retrieveDocuments(
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
async function gradeDocuments(
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
async function transformQuery(
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
    // Reset complexity flag to re-evaluate after transformation
    isComplex: false,
    queries: [],
  }
}

/**
 * NODE 6: Generate Answer
 *
 * Generates the final answer based on the retrieved and graded documents.
 * Uses the response model with higher temperature for natural language.
 */
async function generate(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---GENERATE---')
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

  console.log('✅ Answer Generated')

  console.log('🔍 Usage Metadata:', {
    ...response.usage_metadata,
  })

  return {
    messages: [response],
    answer: generation || 'No answer generated',
  }
}

/**
 * NODE 7: Generate No Answer
 *
 * Generates a helpful "no answer" response when the system
 * cannot find relevant information after all retries.
 */
async function generateNoAnswer(
  state: AgentStateType,
  _config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---GENERATE NO ANSWER---')
  const { messages } = state

  // Extract question from messages (use cached state.question if available)
  const question = state.question || extractLatestQuestion(messages)

  // Format no answer prompt
  const prompt = await PROMPTS.NO_ANSWER.format({ question })

  const generation = prompt

  console.log('⚠️ No Answer Generated')

  return {
    answer: generation,
  }
}

/**
 * CONDITIONAL EDGE: Route after query classification
 *
 * Routes to decomposition if query is complex, otherwise routes directly to retrieval.
 */
function routeAfterQuery(state: AgentStateType): string | Array<Send> {
  if (state.isComplex) {
    console.log('→ Routing to decomposition')
    return GRAPH_NODES.DECOMPOSE_QUERY
  } else {
    console.log('→ Routing directly to retrieval')
    return continueToRetrieval(state)
  }
}

/**
 * CONDITIONAL EDGE: Fan out to parallel retrievals
 *
 * Creates a Send() for each query to execute retrievals in parallel.
 * Each Send passes a QueryInput to the retrieve_documents node.
 */
function continueToRetrieval(state: AgentStateType): Array<Send> {
  const { queries, messages, isComplex } = state

  if (!isComplex || queries.length === 0) {
    // Simple question - use single retrieval with original question
    // Extract from messages if state.question is not available
    const question = state.question || extractLatestQuestion(messages)
    console.log('→ Single retrieval path')
    return [
      new Send(GRAPH_NODES.RETRIEVE_DOCUMENTS, {
        query: question,
        queryIndex: 0,
        documents: [],
      } as QueryInput),
    ]
  }

  // Complex question - parallel retrieval for all sub-queries
  console.log(`→ Parallel retrieval for ${queries.length} queries`)
  return queries.map(
    (query, index) =>
      new Send(GRAPH_NODES.RETRIEVE_DOCUMENTS, {
        query,
        queryIndex: index,
        documents: [],
      } as QueryInput),
  )
}

/**
 * CONDITIONAL EDGE: Decide to Generate
 *
 * Determines the next step based on document availability:
 * - If documents exist → generate answer
 * - If no documents and retries left → transform query and retry
 * - If no documents and max retries reached → generate no answer
 */
function decideToGenerate(
  state: AgentStateType,
  config?: RunnableConfig,
): string {
  console.log('---DECISION POINT: CHECK RELEVANCE---')
  const { documents, loop_step } = state
  console.log('🚀 ~ decideToGenerate > documents:', {
    documents: documents.length,
    map: documents.map((doc) => doc.metadata?.title),
  })
  const agentConfig = getLandLawAgentConfiguration(config)

  const hasDocuments = documents && documents.length > 0
  const currentStep = loop_step || 0
  const maxRetries = agentConfig.maxRetries

  if (!hasDocuments) {
    if (currentStep >= maxRetries) {
      console.log('🚫 Max retries reached. Generating no answer.')
      return GRAPH_NODES.NO_ANSWER
    }
    console.log(
      `🔄 No documents found. Transforming query (attempt ${
        currentStep + 1
      }/${maxRetries})`,
    )
    return GRAPH_NODES.TRANSFORM_QUERY
  }

  console.log('✅ Documents found. Generating answer.')
  return GRAPH_NODES.GENERATE
}

/**
 * Build the Land Law Agentic Workflow Graph
 */
export function buildLandLawGraph() {
  const workflow = new StateGraph(AgentState, {
    input: InputStateAnnotation,
    context: LandLawAgentConfigurationSchema,
  })
    // Add all nodes
    .addNode(GRAPH_NODES.ROUTE_QUERY, routeQuery)
    .addNode(GRAPH_NODES.DECOMPOSE_QUERY, decomposeQuery)
    .addNode(GRAPH_NODES.RETRIEVE_DOCUMENTS, retrieveDocuments)
    .addNode(GRAPH_NODES.GRADE_DOCUMENTS, gradeDocuments)
    .addNode(GRAPH_NODES.TRANSFORM_QUERY, transformQuery)
    .addNode(GRAPH_NODES.GENERATE, generate)
    .addNode(GRAPH_NODES.NO_ANSWER, generateNoAnswer)

    // START → Route Query
    .addEdge(START, GRAPH_NODES.ROUTE_QUERY)

    // Route Query → Decompose (if complex) OR directly use Send for simple
    .addConditionalEdges(GRAPH_NODES.ROUTE_QUERY, routeAfterQuery)

    // Decompose → Parallel Retrieval (using Send)
    .addConditionalEdges(GRAPH_NODES.DECOMPOSE_QUERY, continueToRetrieval)

    // Parallel Retrievals → Grade Documents
    .addEdge(GRAPH_NODES.RETRIEVE_DOCUMENTS, GRAPH_NODES.GRADE_DOCUMENTS)

    // Grade Documents → Decide next step
    .addConditionalEdges(GRAPH_NODES.GRADE_DOCUMENTS, decideToGenerate)

    // Transform Query → Route Query (re-evaluate complexity)
    .addEdge(GRAPH_NODES.TRANSFORM_QUERY, GRAPH_NODES.ROUTE_QUERY)

    // End states
    .addEdge(GRAPH_NODES.GENERATE, END)
    .addEdge(GRAPH_NODES.NO_ANSWER, END)

  // Compile the graph
  const app = workflow.compile()

  return app
}

/**
 * Main graph instance (singleton)
 */
export const landLawGraph = buildLandLawGraph()
