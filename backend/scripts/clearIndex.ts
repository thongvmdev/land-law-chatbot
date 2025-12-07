/**
 * Clear Weaviate index.
 *
 * TypeScript version of the Python clear_index.py script.
 * Clears all documents from the Weaviate collection and record manager.
 */

import 'dotenv/config'

import { WeaviateStore } from '@langchain/weaviate'
import { PostgresRecordManager } from '@langchain/community/indexes/postgres'
import { index } from '@langchain/core/indexing'
import { getWeaviateClient } from '../src/utils.js'
import { getEmbeddingsModel } from '../src/embeddings.js'
import {
  OLLAMA_BASE_EMBEDDING_DOCS_URL,
  WEAVIATE_GENERAL_LAND_LAW_VN,
} from '../src/constants.js'

// Environment variables
const RECORD_MANAGER_DB_URL = process.env.RECORD_MANAGER_DB_URL
const WEAVIATE_URL = process.env.WEAVIATE_URL
const WEAVIATE_GRPC_URL = process.env.WEAVIATE_GRPC_URL
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY

/**
 * Clear all documents from Weaviate collection and record manager.
 */
async function clear(): Promise<void> {
  console.log('Starting index clearing process...')

  // Initialize embeddings model
  const embedding = getEmbeddingsModel(
    'ollama/qwen3-embedding:0.6b',
    OLLAMA_BASE_EMBEDDING_DOCS_URL,
  )

  if (!embedding) {
    throw new Error('Embeddings model is required for clearing index')
  }

  // Initialize Weaviate client
  const weaviateClient = await getWeaviateClient(
    WEAVIATE_URL,
    WEAVIATE_GRPC_URL,
    WEAVIATE_API_KEY,
  )

  let recordManager: PostgresRecordManager | undefined

  try {
    const collectionName = WEAVIATE_GENERAL_LAND_LAW_VN

    // First, directly delete all documents from Weaviate collection
    // This ensures we delete everything, not just what's tracked in record manager
    try {
      const collection = await weaviateClient.collections.get(collectionName)

      // Get count before deletion
      const initialCountResult = await collection.aggregate.overAll()
      const initialCount = initialCountResult.totalCount || 0
      console.log(
        `Found ${initialCount} documents in collection before deletion`,
      )

      if (initialCount > 0) {
        // Fetch all object UUIDs and delete them in parallel batches
        // This is much faster than sequential deletion
        let deletedCount = 0
        const fetchBatchSize = 500 // Fetch more objects at once
        const deleteConcurrency = 10 // Number of parallel delete operations

        while (true) {
          // Fetch a batch of objects (only get UUIDs, not full data)
          const objects = await collection.query.fetchObjects({
            limit: fetchBatchSize,
          })

          if (!objects.objects || objects.objects.length === 0) {
            break
          }

          console.log(
            `Deleting batch of ${objects.objects.length} documents in parallel...`,
          )

          // Delete objects in parallel with controlled concurrency
          const deletePromises = objects.objects.map((obj) =>
            collection.data.deleteById(obj.uuid).catch((error) => {
              console.warn(`Failed to delete object ${obj.uuid}:`, error)
              return null // Return null for failed deletions
            }),
          )

          // Process deletions in chunks to control concurrency
          const chunks = []
          for (let i = 0; i < deletePromises.length; i += deleteConcurrency) {
            chunks.push(deletePromises.slice(i, i + deleteConcurrency))
          }

          // Execute deletion chunks sequentially, but within each chunk run in parallel
          for (const chunk of chunks) {
            await Promise.all(chunk)
            deletedCount += chunk.length
            console.log(
              `Processed ${chunk.length} deletions (total: ${deletedCount})`,
            )
          }

          console.log(
            `Completed batch of ${objects.objects.length} documents (total: ${deletedCount})`,
          )

          // If we got fewer objects than batch_size, we're done
          if (objects.objects.length < fetchBatchSize) {
            break
          }
        }

        console.log(
          `Successfully deleted ${deletedCount} documents directly from Weaviate collection: ${collectionName}`,
        )
      } else {
        console.log('Collection is already empty')
      }
    } catch (error) {
      console.warn('Could not delete directly from collection:', error)
      console.log('Falling back to record manager cleanup...')
    }

    // Create vector store
    const vectorStore = new WeaviateStore(embedding, {
      client: weaviateClient,
      indexName: collectionName,
      textKey: 'text',
      metadataKeys: ['source', 'title'],
    })

    // Create record manager
    // Remove sslmode from connection string as pg client doesn't parse it properly
    // and explicitly set ssl to false since the server doesn't support SSL
    const dbUrl = RECORD_MANAGER_DB_URL?.split('?')[0] || RECORD_MANAGER_DB_URL

    recordManager = new PostgresRecordManager(`weaviate/${collectionName}`, {
      postgresConnectionOptions: {
        connectionString: dbUrl,
        ssl: false,
      },
    })

    await recordManager.createSchema()

    // Also clean up record manager to keep it in sync
    const indexingStats = await index({
      docsSource: [],
      recordManager,
      vectorStore,
      options: {
        cleanup: 'full',
        sourceIdKey: 'source',
      },
    })

    console.log('Indexing stats:', indexingStats)

    // Log final count
    const finalCollection = await weaviateClient.collections.get(collectionName)
    const finalCountResult = await finalCollection.aggregate.overAll()
    const finalCount = finalCountResult.totalCount || 0
    console.log(
      `General Guides and Tutorials now has this many vectors: ${finalCount}`,
    )

    console.log('Index clearing completed successfully!')
  } finally {
    // Cleanup connections
    if (recordManager) {
      await recordManager.end()
      console.log('Record manager connection closed')
    }
    await weaviateClient.close()
    console.log('Weaviate client closed')
  }
}

// Run the clear function if this script is executed directly
if (process.argv[1] && process.argv[1].endsWith('clearIndex.ts')) {
  clear().catch((error) => {
    console.error('Error clearing index:', error)
    process.exit(1)
  })
}

export { clear }
