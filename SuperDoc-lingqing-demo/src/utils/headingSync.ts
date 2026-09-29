import type { FlatTocNode, TocNode } from '@/types/document'
import { findNodeById, updateNodeTitle } from '@/utils/tocTree'

export type SuperDocHeadingDoc = {
  blocks: {
    list(input?: unknown): unknown
  }
  bookmarks: {
    get(input: unknown): unknown
    insert(input: unknown): unknown
  }
  replace(input: unknown, options?: unknown): unknown
}

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function listHeadingBlocks(doc: SuperDocHeadingDoc) {
  return (await Promise.resolve(
    doc.blocks.list({ includeText: true, nodeTypes: ['heading'] }),
  )) as {
    blocks: Array<{
      nodeId: string
      nodeType: string
      text?: string | null
      headingLevel?: number
    }>
  }
}

function isBookmarkNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /bookmarks\.get.*was not found/i.test(error.message)
}

/** SuperDoc 在书签不存在时会 throw，而非返回 null */
async function safeGetBookmark(
  doc: SuperDocHeadingDoc,
  name: string,
): Promise<{ range?: { from?: { blockId?: string } } } | null> {
  try {
    return (await Promise.resolve(
      doc.bookmarks.get({
        target: { kind: 'entity', entityType: 'bookmark', name },
      }),
    )) as { range?: { from?: { blockId?: string } } } | null
  } catch (error) {
    if (isBookmarkNotFoundError(error)) return null
    throw error
  }
}

export async function updateHeadingTitleById(
  doc: SuperDocHeadingDoc,
  id: string,
  title: string,
): Promise<boolean> {
  const bookmark = await safeGetBookmark(doc, id)

  const blockId = bookmark?.range?.from?.blockId
  if (!blockId) return false

  const blocks = await listHeadingBlocks(doc)
  const block = blocks.blocks.find((entry) => entry.nodeId === blockId)
  if (!block?.headingLevel) return false

  const receipt = (await Promise.resolve(
    doc.replace({
      target: { kind: 'block', nodeType: 'heading', nodeId: blockId },
      type: 'html',
      value: `<h${block.headingLevel}>${escapeHtml(title.trim())}</h${block.headingLevel}>`,
    }),
  )) as { success?: boolean }

  return receipt.success === true
}

export async function extractTocHeadingTitles(
  doc: SuperDocHeadingDoc,
  tocIds: Set<string>,
): Promise<Record<string, string>> {
  const titles: Record<string, string> = {}
  const blocks = await listHeadingBlocks(doc)
  const blockById = new Map(blocks.blocks.map((block) => [block.nodeId, block]))

  for (const id of tocIds) {
    const bookmark = await safeGetBookmark(doc, id)

    const blockId = bookmark?.range?.from?.blockId
    if (!blockId) continue

    const block = blockById.get(blockId)
    const text = block?.text?.trim()
    if (text) {
      titles[id] = text
    }
  }

  return titles
}

export async function buildFlatTocFromHeadings(doc: SuperDocHeadingDoc): Promise<FlatTocNode[]> {
  const { blocks } = await listHeadingBlocks(doc)
  const flat: FlatTocNode[] = []
  const stack: Array<{ id: string; level: number }> = []
  let seq = 0

  for (const block of blocks) {
    const level = block.headingLevel ?? 1
    const title = block.text?.trim()
    if (!title) continue

    const id = `heading-${seq}`
    seq += 1

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }
    const parentId = stack.length > 0 ? stack[stack.length - 1].id : null
    flat.push({ id, title, parentId, blockNodeId: block.nodeId })
    stack.push({ id, level })
  }

  return flat
}

export type SuperDocViewport = {
  scrollIntoView(input: {
    target: {
      kind: 'text'
      blockId: string
      range: { start: number; end: number }
    }
    block?: 'start' | 'center' | 'end' | 'nearest'
    behavior?: 'auto' | 'smooth'
  }): Promise<{ success: boolean }>
}

export type SuperDocNavigator = {
  navigateTo(
    target:
      | { kind: 'entity'; entityType: 'bookmark'; name: string }
      | { kind: 'block'; nodeId: string; nodeType?: string },
  ): Promise<boolean>
}

export async function resolveHeadingBlockId(
  doc: SuperDocHeadingDoc,
  id: string,
  blockNodeIdById?: Record<string, string>,
): Promise<string | null> {
  const bookmark = await safeGetBookmark(doc, id)
  const fromBookmark = bookmark?.range?.from?.blockId
  if (fromBookmark) return fromBookmark
  return blockNodeIdById?.[id] ?? null
}

/** 目录项 id → 正文标题块：优先 viewport 滚动，再 fallback 到 bookmark / block 导航 */
export async function navigateToHeadingAnchor(input: {
  doc: SuperDocHeadingDoc | null
  viewport: SuperDocViewport | null
  navigator: SuperDocNavigator | null
  id: string
  blockNodeIdById?: Record<string, string>
}): Promise<boolean> {
  const { doc, viewport, navigator, id, blockNodeIdById } = input

  const blockId = doc
    ? await resolveHeadingBlockId(doc, id, blockNodeIdById)
    : (blockNodeIdById?.[id] ?? null)

  if (blockId && viewport) {
    const result = await viewport.scrollIntoView({
      target: { kind: 'text', blockId, range: { start: 0, end: 0 } },
      block: 'start',
      behavior: 'smooth',
    })
    if (result.success) return true
  }

  if (!navigator) return false

  const bookmarkNavigated = await navigator.navigateTo({
    kind: 'entity',
    entityType: 'bookmark',
    name: id,
  })
  if (bookmarkNavigated) return true

  if (!blockId) return false

  return navigator.navigateTo({
    kind: 'block',
    nodeId: blockId,
    nodeType: 'heading',
  })
}

export async function ensureHeadingBookmarks(
  doc: SuperDocHeadingDoc,
  flatToc: FlatTocNode[],
): Promise<void> {
  for (const tocItem of flatToc) {
    const blockId = tocItem.blockNodeId
    if (!blockId) continue

    const existing = await safeGetBookmark(doc, tocItem.id)
    if (existing) continue

    await Promise.resolve(
      doc.bookmarks.insert({
        name: tocItem.id,
        at: {
          kind: 'text',
          segments: [{ blockId, range: { start: 0, end: 0 } }],
        },
      }),
    )
  }
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
