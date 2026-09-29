import { ref } from 'vue'
import { mockDocumentStream } from '@/mock/mockDocumentStream'
import { callAiDocumentAction } from '@/services/aiDocumentService'
import type { AiDocumentAction } from '@/types/aiAction'
import { AI_ACTION_LABELS } from '@/types/aiAction'
import type { FlatTocNode, StreamEvent, StreamPhase, TocNode } from '@/types/document'
import { syncTocTitlesFromHeadings } from '@/utils/headingSync'
import { isDocxFile } from '@/utils/docxParse'
import { animateTocNodes } from '@/utils/tocAnimation'
import { appendFlatTocNode, updateNodeTitle } from '@/utils/tocTree'

const MAX_DOCX_SIZE_BYTES = 20 * 1024 * 1024

export function useDocumentStream() {
  const tocTree = ref<TocNode[]>([])
  const htmlContent = ref('')
  const isStreaming = ref(false)
  const streamPhase = ref<StreamPhase>('idle')
  const statusMessage = ref('请先上传 Word 文档，再模拟 AI 处理')
  const activeNodeId = ref<string | null>(null)
  const activeAnnotationId = ref<string | null>(null)
  const aiActionLoading = ref<AiDocumentAction | null>(null)
  const headingSyncFromToc = ref<{ id: string; title: string } | null>(null)
  const uploadedFile = ref<File | null>(null)
  const uploadedFileName = ref('')
  const documentLoadToken = ref(0)

  let abortController: AbortController | null = null
  let isSyncingFromToc = false
  let resolveDocumentProcessed: ((flatToc: FlatTocNode[]) => void) | null = null
  let rejectDocumentProcessed: ((error: Error) => void) | null = null

  function resetStreamState() {
    tocTree.value = []
    htmlContent.value = ''
    streamPhase.value = 'idle'
    activeNodeId.value = null
    activeAnnotationId.value = null
    headingSyncFromToc.value = null
  }

  function uploadDocument(file: File) {
    if (isStreaming.value) return

    if (!isDocxFile(file)) {
      statusMessage.value = '仅支持 .docx 格式的 Word 文档'
      return
    }

    if (file.size > MAX_DOCX_SIZE_BYTES) {
      statusMessage.value = '文件过大，请上传 20MB 以内的 .docx 文档'
      return
    }

    abortController?.abort()
    uploadedFile.value = file
    uploadedFileName.value = file.name
    resetStreamState()
    statusMessage.value = `已选择「${file.name}」，点击「模拟 AI 处理文档」加载并还原 Word 格式`
  }

  function waitForDocumentProcessed(): Promise<FlatTocNode[]> {
    return new Promise((resolve, reject) => {
      resolveDocumentProcessed = resolve
      rejectDocumentProcessed = reject
    })
  }

  function onDocumentProcessed(flatToc: FlatTocNode[]) {
    resolveDocumentProcessed?.(flatToc)
    resolveDocumentProcessed = null
    rejectDocumentProcessed = null
  }

  function onDocumentProcessFailed(message: string) {
    rejectDocumentProcessed?.(new Error(message))
    resolveDocumentProcessed = null
    rejectDocumentProcessed = null
  }

  function onExportDocxSuccess(fileName: string) {
    statusMessage.value = `已导出「${fileName}」，格式由 SuperDoc 原生 OOXML 链路写回`
  }

  function onExportDocxFailed(message: string) {
    statusMessage.value = `导出失败：${message}`
  }

  async function consumeStream(events: AsyncGenerator<StreamEvent>) {
    for await (const event of events) {
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
        case 'html':
          htmlContent.value += event.chunk
          break
        case 'done':
          streamPhase.value = 'done'
          break
      }
    }
  }

  async function startMockStream() {
    if (isStreaming.value) return

    abortController?.abort()
    abortController = new AbortController()
    resetStreamState()
    isStreaming.value = true

    try {
      if (uploadedFile.value) {
        streamPhase.value = 'toc'
        statusMessage.value = `正在加载「${uploadedFileName.value}」并还原 Word 格式…`

        const processedPromise = waitForDocumentProcessed()
        documentLoadToken.value += 1

        const flatToc = await processedPromise
        if (abortController.signal.aborted) return

        streamPhase.value = 'toc'
        statusMessage.value = `识别到 ${flatToc.length} 个标题，正在构建目录…`
        await animateTocNodes(
          flatToc,
          (node) => {
            tocTree.value = appendFlatTocNode(tocTree.value, node)
          },
          abortController.signal,
        )
        if (abortController.signal.aborted) return

        streamPhase.value = 'content'
        statusMessage.value = '文档格式已还原，正在完成最后处理…'
        await new Promise((resolve) => setTimeout(resolve, 320))

        streamPhase.value = 'done'
        statusMessage.value =
          flatToc.length > 0
            ? `「${uploadedFileName.value}」已就绪，可编辑；目录与正文标题支持双向联动`
            : `「${uploadedFileName.value}」已就绪（未识别到标题样式，目录为空）`
        return
      }

      await consumeStream(mockDocumentStream(abortController.signal))
    } catch (error) {
      statusMessage.value =
        error instanceof Error ? `文档处理失败：${error.message}` : '文档处理失败'
      streamPhase.value = 'idle'
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
    htmlContent,
    isStreaming,
    streamPhase,
    statusMessage,
    activeNodeId,
    activeAnnotationId,
    aiActionLoading,
    headingSyncFromToc,
    uploadedFile,
    uploadedFileName,
    documentLoadToken,
    uploadDocument,
    startMockStream,
    onDocumentProcessed,
    onDocumentProcessFailed,
    onExportDocxSuccess,
    onExportDocxFailed,
    selectTocNode,
    selectAnnotation,
    closeAnnotation,
    updateTocNodeTitle,
    clearHeadingSyncFromToc,
    syncTocFromDocumentHeadings,
    runAiDocumentAction,
  }
}
