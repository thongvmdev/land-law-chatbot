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
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'
import {
  AgentState,
  AgentStateType,
  InputStateAnnotation,
  QueryInput,
} from './state.js'
import {
  getLandLawAgentConfiguration,
  LandLawAgentConfigurationSchema,
} from './configuration.js'
import { extractLatestQuestion } from '../utils.js'
import { GRAPH_NODES } from '../constants.js'
import {
  checkLandLawRelevance,
  rejectQuestion,
  routeQuery,
  decomposeQuery,
  retrieveDocuments,
  gradeDocuments,
  transformQuery,
  generate,
  generateNoAnswer,
} from './nodes'

const DB_URI = process.env.LANGGRAPH_PERSISTENCE as string
const checkpointer = PostgresSaver.fromConnString(DB_URI)

/**
 * CONDITIONAL EDGE: Route after Land Law relevance check
 *
 * Routes to route_query if the question is related to Land Law,
 * otherwise routes to reject_question.
 */
function routeAfterRelevanceCheck(state: AgentStateType): string {
  if (state.isRelatedToLandLaw) {
    console.log('→ Question related to Land Law - continuing to route query')
    return GRAPH_NODES.ROUTE_QUERY
  } else {
    console.log('→ Question NOT related to Land Law - rejecting')
    return GRAPH_NODES.REJECT_QUESTION
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
export async function buildLandLawGraph() {
  const workflow = new StateGraph(AgentState, {
    input: InputStateAnnotation,
    context: LandLawAgentConfigurationSchema,
  })
    // Add all nodes
    .addNode(GRAPH_NODES.CHECK_RELEVANCE, checkLandLawRelevance)
    .addNode(GRAPH_NODES.REJECT_QUESTION, rejectQuestion)
    .addNode(GRAPH_NODES.ROUTE_QUERY, routeQuery)
    .addNode(GRAPH_NODES.DECOMPOSE_QUERY, decomposeQuery)
    .addNode(GRAPH_NODES.RETRIEVE_DOCUMENTS, retrieveDocuments)
    .addNode(GRAPH_NODES.GRADE_DOCUMENTS, gradeDocuments)
    .addNode(GRAPH_NODES.TRANSFORM_QUERY, transformQuery)
    .addNode(GRAPH_NODES.GENERATE, generate)
    .addNode(GRAPH_NODES.NO_ANSWER, generateNoAnswer)

    // START → Check Land Law Relevance
    .addEdge(START, GRAPH_NODES.CHECK_RELEVANCE)

    // Check Relevance → Route Query (if related) OR Reject (if not related)
    .addConditionalEdges(GRAPH_NODES.CHECK_RELEVANCE, routeAfterRelevanceCheck)

    // Route Query → Decompose (if complex) OR directly use Send for simple
    .addConditionalEdges(GRAPH_NODES.ROUTE_QUERY, routeAfterQuery)

    // Decompose → Parallel Retrieval (using Send)
    .addConditionalEdges(GRAPH_NODES.DECOMPOSE_QUERY, continueToRetrieval)

    // Parallel Retrievals → Grade Documents
    .addEdge(GRAPH_NODES.RETRIEVE_DOCUMENTS, GRAPH_NODES.GRADE_DOCUMENTS)

    // Grade Documents → Decide next step
    .addConditionalEdges(GRAPH_NODES.GRADE_DOCUMENTS, decideToGenerate)

    // Transform Query → Check Relevance (re-check after transformation)
    .addEdge(GRAPH_NODES.TRANSFORM_QUERY, GRAPH_NODES.CHECK_RELEVANCE)

    // End states
    .addEdge(GRAPH_NODES.GENERATE, END)
    .addEdge(GRAPH_NODES.NO_ANSWER, END)
    .addEdge(GRAPH_NODES.REJECT_QUESTION, END)

  // Compile the graph
  const app = workflow.compile({
    checkpointer,
  })

  return app
}

/**
 * Main graph instance (singleton)
 */
export const landLawGraph = buildLandLawGraph()
