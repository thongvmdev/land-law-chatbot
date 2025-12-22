/**
 * Main entrypoint for testing the Land Law Agentic Workflow.
 *
 * This script provides a simple way to test the land law graph locally.
 */

// Load environment variables from .env file
import 'dotenv/config'

import { landLawGraph } from './graph/index.js'

/**
 * Test the graph with a sample query about Vietnamese Land Law
 */
async function testGraph(): Promise<void> {
  try {
    console.log('🚀 Testing Land Law Agentic Workflow...\n')

    // Example questions to test
    const testQuestions = [
      'Quy định chuyển tiếp tại Điều 260 có nội dung gì về đất thuê?',
      'Quyền sử dụng đất của hộ gia đình được quy định như thế nào?',
      'Chương V của Luật Đất đai quy định về điều gì?',
      'Nếu tôi nhận thấy Sổ đỏ cũ ghi sai vị trí (tọa độ bản đồ) của thửa đất, cơ quan có thẩm quyền sẽ xử lý thế nào?',
    ]

    // Use the first question for testing
    const question = testQuestions[3]
    // 'Nếu tôi nhận thấy Sổ đỏ cũ ghi sai vị trí (tọa độ bản đồ) của thửa đất, cơ quan có thẩm quyền sẽ xử lý thế nào?'
    console.log(`📝 Question: ${question}\n`)

    const result = await landLawGraph.invoke({
      question,
      loop_step: 0,
    })

    console.log('\n✅ Graph execution completed!\n')
    console.log('='.repeat(80))
    console.log('🤖 GENERATED ANSWER:')
    console.log('='.repeat(80))
    console.log(result.answer || 'N/A')
    console.log('='.repeat(80))

    console.log(`\n📚 Documents retrieved: ${result.documents?.length || 0}`)
    console.log(`🔄 Loop iterations: ${result.loop_step || 0}`)

    // Print a sample of documents if available
    if (result.documents && result.documents.length > 0) {
      console.log('\n📄 Retrieved Documents:')
      result.documents.forEach((doc, idx) => {
        console.log(`\n  Document ${idx + 1}:`)
        console.log(`    Source: ${doc.metadata?.source || 'N/A'}`)
        console.log(`    Article: ${doc.metadata?.article_id || 'N/A'}`)
        console.log(`    Chapter: ${doc.metadata?.chapter_id || 'N/A'}`)
        console.log(`    Title: ${doc.metadata?.title || 'N/A'}`)
        console.log(`    Preview: ${doc.pageContent.substring(0, 150)}...`)
      })
    }

    console.log('\n' + '='.repeat(80))
  } catch (error) {
    console.error('\n❌ Error executing graph:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    process.exit(1)
  }
}

// Run the test based on command line argument
const testMode = process.argv[2] || 'basic'

testGraph()
  .then(() => {
    console.log('\n✨ Test completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error)
    process.exit(1)
  })
