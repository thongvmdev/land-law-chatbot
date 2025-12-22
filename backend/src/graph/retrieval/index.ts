import { VectorStoreRetriever } from '@langchain/core/vectorstores'
import { WeaviateStore } from '@langchain/weaviate'
import {
  METADATA_KEYS,
  OLLAMA_BASE_URL,
  WEAVIATE_GENERAL_LAND_LAW_VN,
} from '../../constants.js'
import { getWeaviateClient } from '../../utils.js'
import { getEmbeddingsModel } from '../../embeddings/index.js'
import { BaseConfiguration } from '../../configuration.js'

export async function getWeaviateVectorStore(
  baseConfiguration: BaseConfiguration,
): Promise<WeaviateStore> {
  const client = await getWeaviateClient()

  const embeddings = getEmbeddingsModel(
    baseConfiguration.embeddingModel,
    OLLAMA_BASE_URL,
  )

  if (!embeddings) {
    throw new Error(
      'Weaviate built-in vectorizer not yet supported in TypeScript version',
    )
  }

  const indexName = WEAVIATE_GENERAL_LAND_LAW_VN

  const store = new WeaviateStore(embeddings, {
    client,
    indexName,
    textKey: 'text',
    metadataKeys: METADATA_KEYS,
  })

  return store
}

export async function closeWeaviateClient(
  retriever: VectorStoreRetriever,
): Promise<void> {
  // The retriever's vectorStore should have access to the client
  const store = retriever.vectorStore as WeaviateStore
  // Access client via type assertion since it's private but we need to close it
  if (store && (store as any).client) {
    await (store as any).client.close()
  }
}
