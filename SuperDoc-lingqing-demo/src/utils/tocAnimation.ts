import type { FlatTocNode } from '@/types/document'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function animateTocNodes(
  nodes: FlatTocNode[],
  onNode: (node: FlatTocNode) => void,
  signal?: AbortSignal,
) {
  const total = nodes.length

  for (let index = 0; index < nodes.length; index += 1) {
    if (signal?.aborted) return

    const depth = nodes[index].parentId ? (nodes[index].id.match(/-/g)?.length ?? 0) : 0
    const waitMs = depth === 0 ? 220 : depth === 1 ? 160 : 120
    await delay(waitMs)
    onNode(nodes[index])
  }

  if (total === 0) {
    await delay(280)
  }
}
