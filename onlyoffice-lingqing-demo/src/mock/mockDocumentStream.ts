import { MOCK_HTML_SECTIONS, MOCK_TOC } from '@/mock/mockDocumentData'
import { runDocumentStream } from '@/services/documentStreamRunner'
import type { StreamEvent } from '@/types/document'

export async function* mockDocumentStream(signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  yield* runDocumentStream(
    {
      fileName: '演示文档',
      toc: MOCK_TOC,
      sections: MOCK_HTML_SECTIONS,
      sourceLabel: '内置演示文档',
    },
    signal,
  )
}
