/**
 * State definition for the Land Law Agentic Workflow.
 *
 * This module defines the state structure that flows through the graph nodes.
 */

import { Annotation, messagesStateReducer } from '@langchain/langgraph'
import { Document } from '@langchain/core/documents'
import { BaseMessage } from '@langchain/core/messages'
import { reduceDocs } from '../utils'
import isEmpty from 'lodash/isEmpty'

/**
 * Shared channel definitions to ensure all annotations use the same channel instances.
 * This prevents "Channel already exists with a different type" errors.
 */
const messagesChannel = Annotation<BaseMessage[]>({
  reducer: messagesStateReducer,
  default: () => [],
})

/**
 * InputState represents the input to the agent.
 *
 * This is a restricted version of the State that is used to define
 * a narrower interface to the outside world vs. what is maintained internally.
 */
export const InputStateAnnotation = Annotation.Root({
  /**
   * Messages track the primary execution state of the agent.
   *
   * Typically accumulates a pattern of Human/AI/Human/AI messages.
   * Uses messagesStateReducer to merge messages by ID.
   */
  messages: messagesChannel,
})

/**
 * AgentState defines the data structure passed between nodes in the graph.
 *
 * Fields:
 * - question: The user's original question
 * - queries: Decomposed sub-queries for parallel retrieval
 * - isComplex: Whether the question requires decomposition
 * - documents: Retrieved legal document chunks
 * - generation: The final generated answer
 * - loop_step: Counter to prevent infinite loops
 * - messages: Chat history for conversational context
 */
export const AgentState = Annotation.Root({
  ...InputStateAnnotation.spec,

  /**
   * The user's original question about land law
   */
  question: Annotation<string>,

  /**
   * Decomposed queries for parallel retrieval
   * Used when the original question is complex
   */
  queries: Annotation<string[]>({
    reducer: (existing, newQueries) => {
      if (!isEmpty(newQueries)) {
        return newQueries
      }

      return existing
    },
    default: () => [],
  }),

  /**
   * Flag indicating if question is complex and needs decomposition
   */
  isComplex: Annotation<boolean>({
    value: (_existing, newIsComplex) => {
      return newIsComplex
    },
    default: () => false,
  }),

  /**
   * Retrieved legal document chunks
   * Uses smart reducer that:
   * - MERGES documents from parallel retrievals
   */
  documents: Annotation<Document[]>({
    reducer: (existing, newDocs) => {
      return reduceDocs(existing, newDocs)
    },
    default: () => [],
  }),

  /**
   * The final generated answer
   */
  answer: Annotation<string>,

  /**
   * Loop counter to prevent infinite retries
   */
  loop_step: Annotation<number>({
    reducer: (existing, increment) => {
      return (existing || 0) + (increment || 0)
    },
    default: () => 0,
  }),
})

export type AgentStateType = typeof AgentState.State

/**
 * QueryInput for parallel query execution
 * This is a plain interface used to pass data to parallel retrieval nodes.
 * The returned documents are merged via AgentState.documents reducer.
 */
export interface QueryInput {
  query: string
  queryIndex: number
  documents: Document[]
}
