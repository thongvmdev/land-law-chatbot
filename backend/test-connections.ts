import { getWeaviateClient } from './src/utils'

async function testConnections() {
  console.log('='.repeat(60))
  console.log('Testing Connections')
  console.log('='.repeat(60))

  // Test 1: Weaviate Connection
  console.log('\n1. Testing Weaviate Connection...')
  try {
    const client = await getWeaviateClient()
    const isReady = await client.isReady()
    console.log('   ✅ Weaviate connected successfully!')
    console.log('   Ready status:', isReady)

    // Get meta info
    const meta = await client.getMeta()
    console.log('   Version:', meta.version)
  } catch (error) {
    console.error('   ❌ Weaviate connection failed:', error)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Test Complete')
  console.log('='.repeat(60))

  process.exit(0)
}

testConnections()
