/**
 * Land Law Agentic Workflow Graph
 *
 * This module implements the agentic workflow for answering questions about
 * Vietnamese Land Law (Luật Đất đai 2024) using LangGraph.
 *
 * Workflow:
 * 1. Extract metadata from user question (article_id, chapter_id, etc.)
 * 2. Retrieve relevant documents using filters and vector search
 * 3. Grade documents for relevance
 * 4. Transform query if needed (with retry limit)
 * 5. Generate final answer based on retrieved documents
 */

import { StateGraph, START, END } from '@langchain/langgraph'
import { RunnableConfig } from '@langchain/core/runnables'
import { AgentState, AgentStateType } from './state.js'
import {
  getLandLawAgentConfiguration,
  GraderSchema,
  MetadataFilter,
  MetadataFilterSchema,
} from './configuration.js'
import { PROMPTS } from './prompts.js'
import { loadChatModel, formatDocs } from '../utils.js'
import { makeWeaviateRetriever } from './retrieval'
import { FilterValue, Operator } from 'weaviate-client'
import { getBaseConfiguration } from '../configuration.js'

/**
 * NODE 1: Extract Metadata
 *
 * Analyzes the user's question to extract structured metadata
 * (article_id, chapter_id, section_id) for targeted retrieval.
 */
async function extractMetadata(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---EXTRACT METADATA---')
  const { question } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  // Load query model with structured output capability
  const model = loadChatModel(agentConfig.queryModel)
  const metadataExtractor = model.withStructuredOutput(MetadataFilterSchema, {
    name: 'extract_legal_metadata',
  })

  // Format prompt with question
  const prompt = await PROMPTS.METADATA_EXTRACTION.formatMessages({ question })
  const result = await metadataExtractor.invoke(prompt)

  // Clean filters - remove null/undefined values
  const cleanFilters = Object.fromEntries(
    Object.entries(result).filter(([_, v]) => v !== null && v !== undefined),
  ) as MetadataFilter

  return {
    filters: cleanFilters,
  }
}

/**
 * NODE 2: Retrieve Documents
 *
 * Retrieves relevant documents from the vector database.
 * If metadata filters exist (e.g., article_id), they are applied.
 * Otherwise, performs semantic vector search.
 */
async function retrieve(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---RETRIEVE---')
  const { question, filters } = state

  let filter: FilterValue | undefined

  // Apply metadata filters if available
  if (filters && Object.keys(filters).length > 0) {
    console.log('🔍 Applying metadata filters:', filters)

    // Build conditions array using FilterValue format
    const conditions: FilterValue[] = []

    if (filters.article_id) {
      conditions.push({
        target: { property: 'article_id' },
        operator: 'Equal',
        value: filters.article_id,
      })
    }

    if (filters.chapter_id) {
      conditions.push({
        target: { property: 'chapter_id' },
        operator: 'Equal',
        value: filters.chapter_id,
      })
    }

    if (filters.section_id) {
      conditions.push({
        target: { property: 'section_id' },
        operator: 'Equal',
        value: filters.section_id,
      })
    }

    // Build final filter (handles single or multiple conditions)
    if (conditions.length > 0) {
      filter =
        conditions.length === 1
          ? conditions[0]
          : {
              operator: 'And',
              filters: conditions,
              value: null,
            }
    }
  }

  // Create retriever and retrieve documents
  const retriever = await makeWeaviateRetriever(
    getBaseConfiguration(config),
    filter,
  )

  const documents = await retriever.invoke(question)
  console.log(`📄 Retrieved ${documents.length} documents`)

  return {
    documents,
  }
}

/**
 * NODE 3: Grade Documents
 *
 * Evaluates each retrieved document for relevance to the user's question.
 * Only keeps documents that are deemed relevant.
 */
async function gradeDocuments(
  state: AgentStateType,
  config?: RunnableConfig,
): Promise<Partial<AgentStateType>> {
  console.log('---GRADE DOCUMENTS---')
  const { question, documents } = state
  const agentConfig = getLandLawAgentConfiguration(config)

  // Load model with structured output for grading
  const model = loadChatModel(agentConfig.queryModel)
  const grader = model.withStructuredOutput(GraderSchema, {
    name: 'grade_document',
  })

  // Grade all documents in parallel using Promise.allSettled
  const gradingPromises = documents?.map(async (doc) => {
    const prompt = await PROMPTS.GRADER.formatMessages({
      question,
      document: doc.pageContent,
    })
    const grade = (await grader.invoke(prompt)) as { is_relevant: boolean }
    return { doc, grade }
  })

  const results = await Promise.allSettled(gradingPromises)
  const validDocs = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { doc, grade } = result.value
      if (grade.is_relevant) {
        console.log('✅ Document Relevant')
        validDocs.push(doc)
      } else {
        console.log('❌ Document Irrelevant')
      }
    } else {
      console.log('❌ Document Grading Failed:', result.reason)
    }
  }

  console.log(
    `📊 ${validDocs.length}/${documents.length} documents are relevant`,
  )

  return {
    documents: validDocs,
  }
}

/**
 * NODE 4: Transform Query
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
 * NODE 5: Generate Answer
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
 * NODE 6: Generate No Answer
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
    .addNode('extract_metadata', extractMetadata)
    .addNode('retrieve', retrieve)
    .addNode('grade_documents', gradeDocuments)
    .addNode('transform_query', transformQuery)
    .addNode('generate', generate)
    .addNode('no_answer', generateNoAnswer)

    // Define edges
    .addEdge(START, 'extract_metadata')
    .addEdge('extract_metadata', 'retrieve')
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
