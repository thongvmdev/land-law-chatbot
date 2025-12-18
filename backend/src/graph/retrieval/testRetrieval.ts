/**
 * Test script for retrieval functionality.
 *
 * This script provides a simple way to test the Weaviate vector store retrieval
 * with filters and similarity search.
 */

// Load environment variables from .env file
import 'dotenv/config'

import { Filters, FilterValue } from 'weaviate-client'
import { getWeaviateClient } from '../../utils'
import { WeaviateStore } from '@langchain/weaviate'
import { getEmbeddingsModel } from '../../embeddings'
import {
  METADATA_KEYS,
  OLLAMA_BASE_URL,
  WEAVIATE_GENERAL_LAND_LAW_VN,
} from '../../constants'

/**
 * Test the retrieval system with a sample query
 */
async function testRetrieval(): Promise<void> {
  try {
    console.log('🚀 Testing Retrieval System...\n')

    const WEAVIATE_URL = process.env.WEAVIATE_URL
    const WEAVIATE_GRPC_URL = process.env.WEAVIATE_GRPC_URL
    const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY

    console.log('📦 Initializing Weaviate client...')
    const client = await getWeaviateClient(
      WEAVIATE_URL,
      WEAVIATE_GRPC_URL,
      WEAVIATE_API_KEY,
    )

    console.log('🔤 Loading embeddings model...')
    const embeddings = getEmbeddingsModel(
      'ollama/qwen3-embedding:0.6b',
      OLLAMA_BASE_URL,
    )

    if (!embeddings) {
      throw new Error('Embeddings model is not supported')
    }

    console.log('🗄️  Creating vector store...')
    const vectorStore = new WeaviateStore(embeddings, {
      client,
      indexName: WEAVIATE_GENERAL_LAND_LAW_VN,
      textKey: 'text',
      metadataKeys: METADATA_KEYS,
    })

    const collection = client.collections.use(WEAVIATE_GENERAL_LAND_LAW_VN)

    console.log('🔍 Setting up filters...')
    // const filter = Filters.and(
    //   // collection.filter.byProperty('title').like('Điều 260'), // partial match
    //   collection.filter.byProperty('article_id').equal('260'), // exact match by metadata fields
    // )

    // Build conditions array
    const conditions: FilterValue[] = []

    // Add your filter conditions
    conditions.push({
      target: { property: 'article_id' },
      operator: 'Equal',
      value: '260',
    })

    // If you need multiple conditions:
    conditions.push({
      target: { property: 'chapter_id' },
      operator: 'Equal',
      value: 'XVI',
    })

    // Build final filter (handles single or multiple conditions)
    const filter: FilterValue =
      conditions.length === 1
        ? conditions[0]
        : {
            operator: 'And',
            filters: conditions, // Remove the 'value' field - it's not needed for compound filters
            value: null,
          }

    const query = 'Giúp tôi giải thích về quy định chuyển tiếp'
    const k = 5

    console.log(`\n📝 Query: ${query}`)
    console.log(`📊 Retrieving top ${k} results...\n`)

    const similaritySearchResultsretriever = vectorStore.asRetriever({
      k,
      filter,
      verbose: true,
      searchType: 'similarity',
    })

    const documents = await similaritySearchResultsretriever.invoke(query) // or .getRelevantDocuments(query)
    console.log('='.repeat(80))
    console.log('📄 RETRIEVED DOCUMENTS:')
    console.log('='.repeat(80))
    console.log(`Found ${documents.length} document(s)\n`)

    console.log('\n' + '='.repeat(80))
  } catch (error) {
    console.error('\n❌ Error testing retrieval:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    process.exit(1)
  }
}

// Run the test
testRetrieval()
  .then(() => {
    console.log('\n✨ Test completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error)
    process.exit(1)
  })
