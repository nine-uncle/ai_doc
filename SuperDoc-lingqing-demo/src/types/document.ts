export interface TocNode {
  id: string
  title: string
  children: TocNode[]
}

export interface FlatTocNode {
  id: string
  title: string
  parentId: string | null
  /** SuperDoc 标题块 nodeId，用于创建书签锚点 */
  blockNodeId?: string
}

export type StreamPhase = 'idle' | 'toc' | 'content' | 'done'

export type StreamEvent =
  | { type: 'status'; message: string }
  | { type: 'phase'; phase: StreamPhase }
  | { type: 'toc'; node: FlatTocNode }
  | { type: 'html'; chunk: string }
  | { type: 'done' }

/** 从 docx 解析出的可流式写入章节 */
export interface DocumentSection {
  heading?: { level: 1 | 2 | 3; id: string; text: string }
  paragraphs?: string[]
  listItems?: string[]
  htmlBlocks?: string[]
}

export interface ParsedDocxDocument {
  fileName: string
  toc: FlatTocNode[]
  sections: DocumentSection[]
}
