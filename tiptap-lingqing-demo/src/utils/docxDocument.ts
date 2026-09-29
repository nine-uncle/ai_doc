import type { JSONContent } from '@tiptap/core'
import type { FlatTocNode } from '@/types/document'

function extractText(node: JSONContent): string {
  if (node.type === 'text') {
    return node.text ?? ''
  }

  return node.content?.map(extractText).join('') ?? ''
}

export function assignHeadingIds(doc: JSONContent): {
  doc: JSONContent
  flatToc: FlatTocNode[]
} {
  let headingIndex = 0
  const flatToc: FlatTocNode[] = []
  const stack: { level: number; id: string }[] = []

  function processNode(node: JSONContent): JSONContent {
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level ?? 1)
      const title = extractText(node).trim() || `标题 ${headingIndex + 1}`
      const id = (node.attrs?.id as string | undefined) ?? `h-${++headingIndex}`

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      const parentId = stack.length > 0 ? stack[stack.length - 1].id : null
      flatToc.push({ id, title, parentId })
      stack.push({ level, id })

      return {
        ...node,
        attrs: {
          ...node.attrs,
          id,
        },
      }
    }

    if (!node.content?.length) {
      return node
    }

    return {
      ...node,
      content: node.content.map(processNode),
    }
  }

  return {
    doc: processNode(doc),
    flatToc,
  }
}

export function getTopLevelNodes(doc: JSONContent): JSONContent[] {
  return doc.content ?? []
}

export function appendDocNode(current: JSONContent | null, node: JSONContent): JSONContent {
  const content = [...(current?.content ?? []), node]
  return {
    type: 'doc',
    content,
  }
}

export function createEmptyDoc(): JSONContent {
  return { type: 'doc', content: [] }
}
