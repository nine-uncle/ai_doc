const HEADING_WITH_ID_RE = /^<h([1-6])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>$/i

const ANNOTATION_SPAN_RE =
  /<span data-annotation-id="([^"]+)">/g

export interface ParsedHeadingChunk {
  html: string
  bookmarkId: string | null
}

export function enhanceHtmlChunk(html: string): string {
  return html.replace(
    ANNOTATION_SPAN_RE,
    '<span data-annotation-id="$1" class="doc-annotation" style="text-decoration: underline; text-decoration-color: #447dfd; text-decoration-thickness: 2px; text-underline-offset: 3px; cursor: pointer;">',
  )
}

export function parseHeadingChunk(html: string): ParsedHeadingChunk {
  const trimmed = html.trim()
  const match = trimmed.match(HEADING_WITH_ID_RE)
  if (!match) {
    return { html: enhanceHtmlChunk(html), bookmarkId: null }
  }

  const level = match[1]
  const bookmarkId = match[2]
  const inner = match[3]
  return {
    html: enhanceHtmlChunk(`<h${level}>${inner}</h${level}>`),
    bookmarkId,
  }
}

// SuperDoc browser Document API is async-capable; keep helpers loosely typed.
export type SuperDocContentDoc = {
  insert(input: { type: 'html'; value: string }, options?: unknown): unknown
  blocks: {
    list(input?: unknown): unknown
  }
  bookmarks: {
    get(input: unknown): unknown
    insert(input: unknown): unknown
  }
}

async function listHeadings(doc: SuperDocContentDoc) {
  const result = (await Promise.resolve(
    doc.blocks.list({ nodeTypes: ['heading'], includeText: true }),
  )) as {
    total: number
    blocks: Array<{ nodeId: string }>
  }
  return result
}

export async function insertHtmlChunk(doc: SuperDocContentDoc, chunk: string): Promise<void> {
  const { html, bookmarkId } = parseHeadingChunk(chunk)
  const headingCountBefore = bookmarkId
    ? (await listHeadings(doc)).total
    : 0

  const insertReceipt = (await Promise.resolve(
    doc.insert({ type: 'html', value: html }),
  )) as { success?: boolean; failure?: { message?: string } }

  if (insertReceipt?.success === false) {
    throw new Error(insertReceipt.failure?.message ?? 'SuperDoc HTML insert failed')
  }

  if (!bookmarkId) return

  let existing: unknown = null
  try {
    existing = await Promise.resolve(
      doc.bookmarks.get({
        target: { kind: 'entity', entityType: 'bookmark', name: bookmarkId },
      }),
    )
  } catch (error) {
    if (!(error instanceof Error) || !/bookmarks\.get.*was not found/i.test(error.message)) {
      throw error
    }
  }
  if (existing) return

  const headings = await listHeadings(doc)
  const newHeading = headings.blocks[headingCountBefore]
  if (!newHeading) return

  await Promise.resolve(
    doc.bookmarks.insert({
      name: bookmarkId,
      at: {
        kind: 'text',
        segments: [{ blockId: newHeading.nodeId, range: { start: 0, end: 0 } }],
      },
    }),
  )
}
