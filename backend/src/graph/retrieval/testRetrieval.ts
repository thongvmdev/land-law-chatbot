/**
 * Test script for retrieval functionality.
 *
 * This script provides a simple way to test the Weaviate vector store retrieval
 * with filters and similarity search.
 */

// Load environment variables from .env file
import 'dotenv/config'

import { Filters, FilterValue, HybridOptions } from 'weaviate-client'
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

    console.log('📦 Initializing Weaviate client...')
    const client = await getWeaviateClient()

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

    const query = 'Quy định về chuyển tiếp đất đai'
    /* 
          - Find with id 260
          - Split into words/keywords > find&rank with BM25 alorithm > results
          - Vector DB > rank results from BM25 search with embedding vector
          -> Final result
    
    */

    const k = 5

    console.log(`\n📝 Query: ${query}`)
    console.log(`📊 Retrieving top ${k} results...\n`)

    // const similaritySearchResultsretriever = vectorStore.asRetriever({
    //   k,
    //   // filter,
    //   verbose: true,
    //   searchType: 'similarity',
    // })

    // const documents = await similaritySearchResultsretriever.invoke(query) // or .getRelevantDocuments(query)

    const documents = await vectorStore.hybridSearch(query, {
      limit: k,
      filter,
      verbose: true,
      alpha: 0.5,
      returnMetadata: ['score', 'explainScore'],
      fusionType: 'RelativeScore',
    } as HybridOptions<undefined, undefined, undefined>)

    for (let object of documents) {
      console.log(JSON.stringify(object.metadata, null, 2))
      console.log(object.pageContent)
    }

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
