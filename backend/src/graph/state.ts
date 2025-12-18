/**
 * State definition for the Land Law Agentic Workflow.
 *
 * This module defines the state structure that flows through the graph nodes.
 */

import { Annotation, messagesStateReducer } from '@langchain/langgraph'
import { Document } from '@langchain/core/documents'
import { BaseMessage } from '@langchain/core/messages'
import { MetadataFilter } from './configuration'
import { reduceDocs } from '../utils'
import isEmpty from 'lodash/isEmpty'

/**
 * AgentState defines the data structure passed between nodes in the graph.
 *
 * Fields:
 * - question: The user's original question
 * - documents: Retrieved legal document chunks
 * - generation: The final generated answer
 * - filters: Metadata filters extracted from the question
 * - loop_step: Counter to prevent infinite loops
 * - messages: Chat history for conversational context
 */
export const AgentState = Annotation.Root({
  /**
   * The user's question about land law
   */
  question: Annotation<string>,

  /**
   * Retrieved legal document chunks
   * Uses reduceDocs to combine and deduplicate documents
   */
  documents: Annotation<Document[]>({
    reducer: (existing, newDocs) => {
      if (!isEmpty(newDocs)) {
        return newDocs
      }

      return reduceDocs(existing, newDocs)
    },
    default: () => [],
  }),

  /**
   * The final generated answer
   */
  answer: Annotation<string>,

  /**
   * Metadata filters for targeted retrieval
   */
  filters: Annotation<MetadataFilter>({
    reducer: (existing, newFilters) => {
      return { ...existing, ...newFilters }
    },
    default: () => ({}),
  }),

  /**
   * Loop counter to prevent infinite retries
   */
  loop_step: Annotation<number>({
    reducer: (existing, increment) => {
      return (existing || 0) + (increment || 0)
    },
    default: () => 0,
  }),

  /**
   * Chat message history for conversational context
   */
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
})

export type AgentStateType = typeof AgentState.State
