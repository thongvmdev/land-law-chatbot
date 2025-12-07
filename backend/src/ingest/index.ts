import { ingestDocs } from './ingest'

export default ingestDocs

/**
 * Run ingestion if this file is executed directly
 */
import { fileURLToPath } from 'url'
import { resolve } from 'path'

const currentFile = fileURLToPath(import.meta.url)
const executedFile = resolve(process.argv[1])

console.log('🔍 Checking execution context:')
console.log('  Current file:', currentFile)
console.log('  Executed file:', executedFile)
console.log('  Match:', currentFile === executedFile)

if (currentFile === executedFile) {
  console.log('✅ Running ingest function...')
  ingestDocs()
    .then(() => {
      console.log('Done!')
      process.exit(0)
    })
    .catch((error: any) => {
      console.error('Ingestion failed:', error)
      process.exit(1)
    })
} else {
  console.log('❌ File not executed directly, skipping ingest')
}
