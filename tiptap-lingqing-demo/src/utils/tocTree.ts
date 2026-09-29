import type { FlatTocNode, TocNode } from '@/types/document'

export function appendFlatTocNode(tree: TocNode[], node: FlatTocNode): TocNode[] {
  const nextNode: TocNode = { id: node.id, title: node.title, children: [] }

  if (!node.parentId) {
    return [...tree, nextNode]
  }

  let changed = false

  const nextTree = tree.map((item) => {
    if (item.id === node.parentId) {
      changed = true
      return {
        id: item.id,
        title: item.title,
        children: [...item.children, nextNode],
      }
    }

    const nextChildren = appendFlatTocNode(item.children, node)
    if (nextChildren !== item.children) {
      changed = true
      return {
        id: item.id,
        title: item.title,
        children: nextChildren,
      }
    }

    return item
  })

  return changed ? nextTree : tree
}

export function findNodeById(nodes: TocNode[], id: string): TocNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNodeById(node.children, id)
    if (found) return found
  }
  return null
}

export function updateNodeTitle(tree: TocNode[], id: string, title: string): TocNode[] {
  let changed = false

  const nextTree = tree.map((item) => {
    if (item.id === id) {
      changed = true
      return {
        id: item.id,
        title,
        children: item.children,
      }
    }

    const nextChildren = updateNodeTitle(item.children, id, title)
    if (nextChildren !== item.children) {
      changed = true
      return {
        id: item.id,
        title: item.title,
        children: nextChildren,
      }
    }

    return item
  })

  return changed ? nextTree : tree
}
