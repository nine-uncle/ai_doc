import type { JSONContent } from '@tiptap/core'

export interface TocNode {
  id: string
  title: string
  children: TocNode[]
}

export interface FlatTocNode {
  id: string
  title: string
  parentId: string | null
}

export type StreamPhase = 'idle' | 'toc' | 'content' | 'done'

export type StreamEvent =
  | { type: 'status'; message: string }
  | { type: 'phase'; phase: StreamPhase }
  | { type: 'toc'; node: FlatTocNode }
  | { type: 'html'; chunk: string }
  | { type: 'json'; node: JSONContent }
  | { type: 'done'; preparedDoc?: JSONContent }

export interface DocxImportReport {
  headingCount: number
  paragraphCount: number
  tableCount: number
  imageCount: number
  listCount: number
  styledTextCount: number
}
