import { landLawGraph } from '../src/graph/graph.js'

import { writeFile } from 'fs/promises'
import { resolve } from 'path'

async function exportMermaid() {
  const graph = await (await landLawGraph).getGraphAsync()
  const mermaidBlobPromise = graph.drawMermaidPng?.()
  if (!mermaidBlobPromise) {
    throw new Error('Could not generate Mermaid diagram')
  }
  const mermaidBlob = await mermaidBlobPromise
  const buffer = Buffer.from(await mermaidBlob.arrayBuffer())
  const outputPath = resolve(process.cwd(), 'graph.png')
  await writeFile(outputPath, buffer)
  console.log(`Mermaid diagram written to ${outputPath}`)
}

exportMermaid()
