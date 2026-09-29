import type { Editor } from '@tiptap/core'
import type { TocNode } from '@/types/document'
import { findNodeById, updateNodeTitle } from '@/utils/tocTree'

export function collectTocIds(nodes: TocNode[]): Set<string> {
  const ids = new Set<string>()

  const walk = (list: TocNode[]) => {
    for (const node of list) {
      ids.add(node.id)
      walk(node.children)
    }
  }

  walk(nodes)
  return ids
}

export function updateHeadingTitleById(editor: Editor, id: string, title: string): boolean {
  const { doc } = editor.state
  let transaction = editor.state.tr
  let updated = false

  doc.descendants((node, pos) => {
    if (updated) return false
    if (node.type.name !== 'heading' || node.attrs.id !== id) return

    const from = pos + 1
    const to = pos + node.nodeSize - 1
    transaction = transaction.replaceWith(
      from,
      to,
      title ? editor.schema.text(title) : [],
    )
    updated = true
    return false
  })

  if (updated) {
    editor.view.dispatch(transaction)
  }

  return updated
}

export function extractTocHeadingTitles(
  editor: Editor,
  tocIds: Set<string>,
): Record<string, string> {
  const titles: Record<string, string> = {}

  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'heading') return

    const id = node.attrs.id as string | null
    if (id && tocIds.has(id)) {
      titles[id] = node.textContent
    }
  })

  return titles
}

export function syncTocTitlesFromHeadings(
  tree: TocNode[],
  titles: Record<string, string>,
): TocNode[] {
  let nextTree = tree

  for (const [id, title] of Object.entries(titles)) {
    const trimmed = title.trim()
    if (!trimmed) continue

    const node = findNodeById(nextTree, id)
    if (node && node.title !== trimmed) {
      nextTree = updateNodeTitle(nextTree, id, trimmed)
    }
  }

  return nextTree
}
