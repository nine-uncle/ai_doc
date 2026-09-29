import { ref } from 'vue'
import type { JSONContent } from '@tiptap/core'
import { docxDocumentStream } from '@/mock/docxDocumentStream'
import { callAiDocumentAction } from '@/services/aiDocumentService'
import { importDocxFile } from '@/services/docxImportService'
import type { AiDocumentAction } from '@/types/aiAction'
import { AI_ACTION_LABELS } from '@/types/aiAction'
import type { DocxImportReport, StreamPhase, TocNode } from '@/types/document'
import { appendDocNode, createEmptyDoc } from '@/utils/docxDocument'
import { syncTocTitlesFromHeadings } from '@/utils/headingSync'
import { appendFlatTocNode, updateNodeTitle } from '@/utils/tocTree'

export function useDocumentStream() {
  const tocTree = ref<TocNode[]>([])
  const editorContent = ref<JSONContent | null>(null)
  const uploadedFileName = ref<string | null>(null)
  const importReport = ref<DocxImportReport | null>(null)
  const isUploading = ref(false)
  const isStreaming = ref(false)
  const streamPhase = ref<StreamPhase>('idle')
  const statusMessage = ref('请先上传 .docx 样例，再模拟 AI 处理')
  const activeNodeId = ref<string | null>(null)
  const activeAnnotationId = ref<string | null>(null)
  const aiActionLoading = ref<AiDocumentAction | null>(null)
  const headingSyncFromToc = ref<{ id: string; title: string } | null>(null)

  let abortController: AbortController | null = null
  let isSyncingFromToc = false
  let parsedSourceDoc: JSONContent | null = null

  function resetStreamView() {
    tocTree.value = []
    editorContent.value = createEmptyDoc()
    streamPhase.value = 'idle'
    activeNodeId.value = null
    activeAnnotationId.value = null
    headingSyncFromToc.value = null
  }

  async function uploadDocx(file: File) {
    if (isUploading.value || isStreaming.value) return

    isUploading.value = true
    statusMessage.value = `正在解析「${file.name}」…`

    try {
      const result = await importDocxFile(file)
      parsedSourceDoc = result.content
      uploadedFileName.value = result.fileName
      importReport.value = result.report
      resetStreamView()
      statusMessage.value = `已加载「${result.fileName}」，点击「模拟 AI 处理文档」查看展示效果`
    } catch (error) {
      parsedSourceDoc = null
      uploadedFileName.value = null
      importReport.value = null
      statusMessage.value =
        error instanceof Error ? `解析失败：${error.message}` : '文档解析失败'
    } finally {
      isUploading.value = false
    }
  }

  async function startMockStream() {
    if (isStreaming.value) return

    if (!parsedSourceDoc || !uploadedFileName.value) {
      statusMessage.value = '请先上传 .docx 文件'
      return
    }

    abortController?.abort()
    abortController = new AbortController()
    resetStreamView()
    isStreaming.value = true

    try {
      for await (const event of docxDocumentStream(
        parsedSourceDoc,
        uploadedFileName.value,
        abortController.signal,
      )) {
        switch (event.type) {
          case 'status':
            statusMessage.value = event.message
            break
          case 'phase':
            streamPhase.value = event.phase
            break
          case 'toc':
            tocTree.value = appendFlatTocNode(tocTree.value, event.node)
            break
          case 'json':
            editorContent.value = appendDocNode(editorContent.value, event.node)
            break
          case 'done':
            if (event.preparedDoc) {
              editorContent.value = event.preparedDoc
            }
            streamPhase.value = 'done'
            break
        }
      }
    } finally {
      isStreaming.value = false
    }
  }

  function selectTocNode(id: string) {
    activeNodeId.value = id
  }

  function selectAnnotation(id: string) {
    activeAnnotationId.value = id
  }

  function closeAnnotation() {
    activeAnnotationId.value = null
  }

  function updateTocNodeTitle(id: string, title: string) {
    const nextTitle = title.trim()
    if (!nextTitle) return

    tocTree.value = updateNodeTitle(tocTree.value, id, nextTitle)
    isSyncingFromToc = true
    headingSyncFromToc.value = { id, title: nextTitle }
  }

  function clearHeadingSyncFromToc() {
    headingSyncFromToc.value = null
    queueMicrotask(() => {
      isSyncingFromToc = false
    })
  }

  function syncTocFromDocumentHeadings(titles: Record<string, string>) {
    if (isSyncingFromToc || isStreaming.value) return

    const nextTree = syncTocTitlesFromHeadings(tocTree.value, titles)
    if (nextTree !== tocTree.value) {
      tocTree.value = nextTree
    }
  }

  async function runAiDocumentAction(
    action: AiDocumentAction,
    text: string,
    from: number,
    to: number,
  ) {
    if (aiActionLoading.value) return

    aiActionLoading.value = action
    statusMessage.value = `正在${AI_ACTION_LABELS[action]}…`

    try {
      const result = await callAiDocumentAction({ action, text, from, to })
      statusMessage.value = result.message
    } catch (error) {
      statusMessage.value =
        error instanceof Error ? `${AI_ACTION_LABELS[action]}失败：${error.message}` : '操作失败'
    } finally {
      aiActionLoading.value = null
    }
  }

  return {
    tocTree,
    editorContent,
    uploadedFileName,
    importReport,
    isUploading,
    isStreaming,
    streamPhase,
    statusMessage,
    activeNodeId,
    activeAnnotationId,
    aiActionLoading,
    headingSyncFromToc,
    uploadDocx,
    startMockStream,
    selectTocNode,
    selectAnnotation,
    closeAnnotation,
    updateTocNodeTitle,
    clearHeadingSyncFromToc,
    syncTocFromDocumentHeadings,
    runAiDocumentAction,
  }
}
