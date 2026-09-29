import { ref } from 'vue'
import { mockDocumentStream } from '@/mock/mockDocumentStream'
import { callAiDocumentAction } from '@/services/aiDocumentService'
import type { AiDocumentAction } from '@/types/aiAction'
import { AI_ACTION_LABELS } from '@/types/aiAction'
import type { StreamEvent, StreamPhase, TocNode } from '@/types/document'
import { isDocxFile } from '@/utils/docxParse'
import { appendFlatTocNode, updateNodeTitle } from '@/utils/tocTree'

const MAX_DOCX_SIZE_BYTES = 20 * 1024 * 1024

export function useDocumentStream() {
  const tocTree = ref<TocNode[]>([])
  const isStreaming = ref(false)
  const streamPhase = ref<StreamPhase>('idle')
  const statusMessage = ref('请先上传 Word 文档，再模拟 AI 处理')
  const activeNodeId = ref<string | null>(null)
  const activeAnnotationId = ref<string | null>(null)
  const aiActionLoading = ref<AiDocumentAction | null>(null)
  const uploadedFile = ref<File | null>(null)
  const uploadedFileName = ref('')
  const documentLoadToken = ref(0)

  let abortController: AbortController | null = null
  let resolveEditorReady: (() => void) | null = null
  let rejectEditorReady: ((error: Error) => void) | null = null

  function resetStreamState() {
    tocTree.value = []
    streamPhase.value = 'idle'
    activeNodeId.value = null
    activeAnnotationId.value = null
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
    statusMessage.value = `已选择「${file.name}」，点击「模拟 AI 处理文档」在 ONLYOFFICE 中打开`
  }

  function waitForEditorReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      resolveEditorReady = resolve
      rejectEditorReady = reject
    })
  }

  function onEditorReady() {
    resolveEditorReady?.()
    resolveEditorReady = null
    rejectEditorReady = null
  }

  function onDocumentProcessFailed(message: string) {
    rejectEditorReady?.(new Error(message))
    resolveEditorReady = null
    rejectEditorReady = null
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
        case 'done':
          streamPhase.value = 'done'
          break
        case 'html':
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
        statusMessage.value = `正在 ONLYOFFICE 中加载「${uploadedFileName.value}」…`

        const readyPromise = waitForEditorReady()
        documentLoadToken.value += 1
        await readyPromise

        if (abortController.signal.aborted) return

        streamPhase.value = 'done'
        statusMessage.value =
          '文档已在 ONLYOFFICE 中打开。本地文件需后端 URL 才能替换为实际上传内容；目录联动需后续接入 ONLYOFFICE API。'
        return
      }

      documentLoadToken.value += 1
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
    isStreaming,
    streamPhase,
    statusMessage,
    activeNodeId,
    activeAnnotationId,
    aiActionLoading,
    uploadedFile,
    uploadedFileName,
    documentLoadToken,
    uploadDocument,
    startMockStream,
    onEditorReady,
    onDocumentProcessFailed,
    selectTocNode,
    selectAnnotation,
    closeAnnotation,
    updateTocNodeTitle,
    runAiDocumentAction,
  }
}
