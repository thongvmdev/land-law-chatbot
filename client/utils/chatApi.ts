import { Client, Thread } from "@langchain/langgraph-sdk";
import type { ThreadState } from "@langchain/langgraph-sdk";

export interface ThreadItem {
  thread_id: string;
  title: string;
  created_at: string;
  values?: Record<string, any>;
}

/**
 * Creates a LangGraph SDK client instance
 * Uses the Next.js API proxy endpoint to communicate with the LangGraph backend
 */
export const createClient = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  return new Client({
    apiUrl,
  });
};

/**
 * Converts a Thread object to ThreadItem format
 * Extracts title from the first message content or uses "Untitled"
 */
const convertThreadToThreadItem = (thread: Thread): ThreadItem => {
  const values = thread.values as Record<string, any> | undefined;
  const firstMessage = values?.messages?.[0];
  const title = firstMessage?.content || "Untitled";

  return {
    thread_id: thread.thread_id,
    title: typeof title === "string" ? title : "Untitled",
    created_at: thread.created_at,
    values: values,
  };
};

/**
 * Creates a new thread
 * @param userId Optional user ID to attach to the thread
 * @returns Promise with the created thread
 */
export const createThread = async (userId?: string) => {
  const client = createClient();
  const metadata = userId ? { user_id: userId } : undefined;
  return await client.threads.create({ metadata });
};

/**
 * Gets the current state of a thread
 * @param threadId The thread ID to fetch
 * @returns Promise with the thread state
 */
export const getThreadState = async (threadId: string) => {
  const client = createClient();
  return (await client.threads.getState(threadId)) as Awaited<ThreadState>;
};

/**
 * Gets a thread by ID
 * @param threadId The thread ID to fetch
 * @returns Promise with the thread
 */
export const getThread = async (threadId: string) => {
  const client = createClient();
  return (await client.threads.get(threadId)) as Awaited<Thread>;
};

/**
 * Sends a message to a thread and streams the response
 * @param params Object containing threadId, messages, and optional command
 * @returns Async generator for streaming responses
 */
export const sendMessage = async ({
  threadId,
  messages,
  command,
}: {
  threadId: string;
  messages: any[];
  command?: any;
}) => {
  const client = createClient();
  const assistantId = "chat"; // This should match your graph_id in langgraph.json

  return client.runs.stream(threadId, assistantId, {
    input: { messages },
    command,
    streamMode: "messages",
  });
};

/**
 * Lists all threads, optionally filtered by user ID
 * @param userId Optional user ID to filter threads
 * @param limit Maximum number of threads to return (default: 100)
 * @returns Promise with array of thread items
 */
export const listThreads = async (
  userId?: string,
  limit: number = 100,
): Promise<ThreadItem[]> => {
  const client = createClient();
  const metadata = userId ? { user_id: userId } : undefined;
  const threads = (await client.threads.search({
    metadata,
    limit,
  })) as Awaited<Thread[]>;

  return threads.map(convertThreadToThreadItem);
};

/**
 * Searches for threads matching specific criteria
 * @param params Search parameters including metadata and limit
 * @returns Promise with array of matching thread items
 */
export const searchThreads = async ({
  metadata,
  limit = 100,
}: {
  metadata?: Record<string, any>;
  limit?: number;
}): Promise<ThreadItem[]> => {
  const client = createClient();
  const threads = (await client.threads.search({
    metadata,
    limit,
  })) as Awaited<Thread[]>;

  return threads.map(convertThreadToThreadItem);
};

/**
 * Deletes a thread by ID
 * @param threadId The thread ID to delete
 * @returns Promise that resolves when deletion is complete
 */
export const deleteThread = async (threadId: string) => {
  const client = createClient();
  return await client.threads.delete(threadId);
};
