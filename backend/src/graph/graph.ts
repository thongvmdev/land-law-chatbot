/**
 * Land Law Agentic Workflow Graph
 *
 * This module implements the agentic workflow for answering questions about
 * Vietnamese Land Law (Luật Đất đai 2024) using LangGraph.
 *
 * Workflow:
 * 1. Retrieve relevant documents using hybrid search (BM25 + vector)
 * 2. Grade documents for relevance
 * 3. Transform query if needed (with retry limit)
 * 4. Generate final answer based on retrieved documents
 */

import { StateGraph, START, END } from '@langchain/langgraph'
import { RunnableConfig } from '@langchain/core/runnables'
import { AgentState, AgentStateType } from './state.js'
import { getLandLawAgentConfiguration } from './configuration.js'
import { PROMPTS } from './prompts.js'
import { loadChatModel, formatDocs } from '../utils.js'
import { getWeaviateVectorStore } from './retrieval'
import { HybridOptions } from 'weaviate-client'
import { getBaseConfiguration } from '../configuration.js'

/**
 * NODE 1: Retrieve Documents
 *
 * Retrieves relevant documents from the vector database using hybrid search.
 * Combines BM25 keyword search with vector similarity for optimal results.
 */
async function retrieve(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---RETRIEVE---')
  const { question } = state
  const baseConfiguration = getBaseConfiguration(config)
  const vectorStore = await getWeaviateVectorStore(baseConfiguration)

  const documents = await vectorStore.hybridSearch(question, {
    limit: baseConfiguration.searchKwargs.limit,
    verbose: baseConfiguration.searchKwargs.verbose,
    alpha: baseConfiguration.searchKwargs.alpha,
    returnMetadata: baseConfiguration.searchKwargs.returnMetadata,
    fusionType: baseConfiguration.searchKwargs.fusionType,
  } as HybridOptions<undefined, undefined, undefined>)

  return {
    documents,
  }
}

/**
 * NODE 2: Grade Documents (Score-Based)
 *
 * Filters documents based on Weaviate's hybrid search score.
 * Much faster and more cost-effective than LLM-based grading.
 * Uses the score from Weaviate's hybrid search (combining BM25 + vector similarity).
 */
async function gradeDocuments(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---GRADE DOCUMENTS (SCORE-BASED)---')
  const { documents } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  // Get threshold and minimum documents from config
  const scoreThreshold = agentConfig.scoreThreshold ?? 0.5
  const minDocuments = agentConfig.minDocuments ?? 2

  if (!documents || documents.length === 0) {
    console.log('⚠️ No documents to grade')
    return {
      documents: [],
    }
  }

  const validDocs = []
  const rejectedDocs: Array<{ doc: (typeof documents)[0]; score: number }> = []

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
      rejectedDocs.push({ doc, score })
    }
  }

  // Fallback: If no docs pass threshold, keep top N by score
  if (validDocs.length === 0 && documents.length > 0) {
    console.log(
      `⚠️ No documents passed threshold (${scoreThreshold}), keeping top ${minDocuments} by score`,
    )
    const sorted = [...documents].sort(
      (a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0),
    )
    const topDocs = sorted.slice(0, minDocuments)
    topDocs.forEach((doc) => {
      const score = doc.metadata?.score as number | undefined
      console.log(`📌 Keeping document (score: ${score?.toFixed(4) ?? 'N/A'})`)
    })
    validDocs.push(...topDocs)
  }

  console.log(
    `📊 ${validDocs.length}/${documents.length} documents passed (threshold: ${scoreThreshold})`,
  )

  return {
    documents: validDocs,
  }
}

/**
 * NODE 3: Transform Query
 *
 * Rewrites the user's question using legal terminology and
 * optimization strategies to improve retrieval in the next iteration.
 */
async function transformQuery(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---TRANSFORM QUERY---')
  const { question, loop_step } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  // Load model for query transformation
  const model = loadChatModel(agentConfig.queryModel)

  // Format prompt for transformation
  const messages = await PROMPTS.QUERY_TRANSFORM.formatMessages({ question })

  const response = await model.invoke(messages)
  const betterQuestion =
    typeof response.content === 'string' ? response.content : question

  console.log(`🔄 Original: ${question}`)
  console.log(`🔄 Transformed: ${betterQuestion}`)

  return {
    question: betterQuestion,
    loop_step: loop_step, // Increment loop step
  }
}

/**
 * NODE 4: Generate Answer
 *
 * Generates the final answer based on the retrieved and graded documents.
 * Uses the response model with higher temperature for natural language.
 */
async function generate(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---GENERATE---')
  const { question, documents } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  // Format documents as context
  const context = formatDocs(documents)

  // Load response model
  const model = loadChatModel(agentConfig.responseModel)

  // Format prompt for generation
  const messages = await PROMPTS.GENERATION.formatMessages({
    context,
    question,
  })

  const response = await model.invoke(messages)

  const generation =
    typeof response.content === 'string'
      ? response.content
      : 'Xin lỗi, tôi không thể tạo câu trả lời lúc này.'

  console.log('✅ Answer Generated')

  return {
    answer: generation,
    messages: [response],
  }
}

/**
 * NODE 5: Generate No Answer
 *
 * Generates a helpful "no answer" response when the system
 * cannot find relevant information after all retries.
 */
async function generateNoAnswer(
  state: AgentStateType,
  _config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---GENERATE NO ANSWER---')
  const { question } = state

  // Format no answer prompt
  const prompt = await PROMPTS.NO_ANSWER.format({ question })

  const generation = prompt

  console.log('⚠️ No Answer Generated')

  return {
    answer: generation,
  }
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
      return 'no_answer'
    }
    console.log(
      `🔄 No documents found. Transforming query (attempt ${
        currentStep + 1
      }/${maxRetries})`,
    )
    return 'transform_query'
  }

  console.log('✅ Documents found. Generating answer.')
  return 'generate'
}

/**
 * Build the Land Law Agentic Workflow Graph
 */
export function buildLandLawGraph() {
  const workflow = new StateGraph(AgentState)
    // Add all nodes
    .addNode('retrieve', retrieve)
    .addNode('grade_documents', gradeDocuments)
    .addNode('transform_query', transformQuery)
    .addNode('generate', generate)
    .addNode('no_answer', generateNoAnswer)

    // Define edges - start directly with retrieval
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'grade_documents')

    // Conditional edge: decide next step after grading
    .addConditionalEdges('grade_documents', decideToGenerate, {
      transform_query: 'transform_query',
      generate: 'generate',
      no_answer: 'no_answer',
    })

    // Loop: transform query goes back to retrieve
    .addEdge('transform_query', 'retrieve')

    // End states
    .addEdge('generate', END)
    .addEdge('no_answer', END)

  // Compile the graph
  const app = workflow.compile()

  return app
}

/**
 * Main graph instance (singleton)
 */
export const landLawGraph = buildLandLawGraph()
