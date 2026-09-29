<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CollaboraEditor from '@/components/CollaboraEditor.vue'
import { openFromTemplate, refreshFileStatus } from '@/services/collaboraService'
import { getDocumentById } from '@/services/documentMockService'
import type { CollaboraExportFormat, WopiLaunchInfo } from '@/types/collabora'
import type { DocumentItem } from '@/types/document'
import { AIDOC_CHATBOX_PATH, AIDOC_PATH } from '@/router'
import { LeftOutlined } from '@nancal-icon/icons-vue'
import { isSelectionAiToolId, SELECTION_AI_TOOLS, type SelectionAiToolId } from '@/constants/selectionAiTools'
import {
  HOST_SOURCE,
  isChatboxToHostMessage,
  type ChatboxDocumentContext,
} from '@/constants/chatboxBridge'

interface AiAnalysis {
  summary: string
  risks: string[]
  suggestions: string[]
  html: string
  streamText: string
}

const editorRef = ref<InstanceType<typeof CollaboraEditor> | null>(null)
const chatIframeRef = ref<HTMLIFrameElement | null>(null)
const session = ref<WopiLaunchInfo | null>(null)
const documentItem = ref<DocumentItem | null>(null)
const analysis = ref<AiAnalysis | null>(null)
const statusMessage = ref('正在打开文档…')
const isOpening = ref(false)
const isAnalyzing = ref(false)
const isEditorReady = ref(false)
const isModified = ref(false)
const isAiStreaming = ref(false)
const isAiToolRunning = ref(false)
const loadError = ref('')
const exportFormats = ref<CollaboraExportFormat[]>([])
const selectedExportFormat = ref('')
const exportFormatOptions = computed(() => exportFormats.value.map(({ format, label }) => ({
  value: format,
  label: `${label} (.${format})`,
})))
const collaboraUrl = (import.meta.env.VITE_COLLABORA_URL || 'http://localhost:9980').replace(/\/$/, '')
const isAiProcessing = computed(() => isAiStreaming.value || isAiToolRunning.value)
const documentId = readDocumentId()
const chatboxUrl = computed(() => {
  const configured = (import.meta.env.VITE_CHATBOX_URL || '').trim()
  if (configured) return configured
  const query = documentId ? `?id=${documentId}` : ''
  return `${AIDOC_CHATBOX_PATH}${query}`
})
let activeAiStreamId = 0
let activeAiToolId = 0
let activeAiEventSource: EventSource | null = null
let resolveActiveAiStream: (() => void) | null = null

function readDocumentId() {
  const id = Number(new URLSearchParams(window.location.search).get('id') || '')
  return Number.isInteger(id) && id > 0 ? id : null
}

function buildDocumentBlocks(document: DocumentItem) {
  return [
    { type: 'heading1' as const, text: document.name },
    { type: 'heading2' as const, text: '基本信息' },
    { type: 'paragraph' as const, text: `项目 / 批次：${document.project || '未填写'}` },
    { type: 'paragraph' as const, text: `文档类型：${document.type}　　专业：${document.major}　　状态：${document.status}` },
    { type: 'paragraph' as const, text: `模板：${document.template}　　负责人：${document.owner}　　版本：${document.version}` },
    { type: 'heading2' as const, text: '编写目标' },
    { type: 'paragraph' as const, text: document.goal || '暂未填写编写目标。' },
    { type: 'heading2' as const, text: '正文' },
    { type: 'paragraph' as const, text: document.description || '可在此继续编写文档内容。' },
    { type: 'paragraph' as const, text: '选中上方文字后，可使用选区工具栏中的改写、扩写、缩写、润色等 AI 能力。' },
  ]
}

function buildAiAnalysis(document: DocumentItem): AiAnalysis {
  const summary = `《${document.name}》是一份${document.type}（${document.major}），当前状态为${document.status}。编写目标：${document.goal || document.description || '待补充'}。`
  const risks = [
    document.issues > 0 ? `文档标记了 ${document.issues} 项校验问题，建议先核对后再定稿。` : '当前未标记校验问题。',
    document.goal ? '编写目标已明确，可据此展开章节。' : '编写目标为空，AI 生成内容可能较泛。',
    document.status === '草稿' ? '仍为草稿，适合先生成目录再填充正文。' : `处于「${document.status}」，写入前请确认选区位置。`,
  ]
  const suggestions = ['点击「生成目录」插入结构提纲', '划选一段正文后，使用改写 / 扩写 / 润色', '点击「将分析写入文档」，把本结论插入正文']
  const html = `
    <h2>AI 分析（模拟）</h2>
    <p>${summary}</p>
    <p><strong>风险与缺口</strong></p>
    ${risks.map((item) => `<p>· ${item}</p>`).join('')}
    <p><strong>编写建议</strong></p>
    ${suggestions.map((item) => `<p>· ${item}</p>`).join('')}
  `
  return {
    summary,
    risks,
    suggestions,
    html,
    streamText: `基于《${document.name}》的编写目标，建议先明确章节结构，再补充可校验、可追溯的正文内容。`,
  }
}

async function openListedDocument() {
  if (!documentId) {
    loadError.value = '未指定文档，请从文档列表点击「打开」。'
    statusMessage.value = loadError.value
    return
  }

  isOpening.value = true
  loadError.value = ''
  statusMessage.value = '正在根据列表文档准备编辑器…'
  try {
    const document = await getDocumentById(documentId)
    if (!document) throw new Error('文档不存在或本地模拟数据已清空')
    documentItem.value = document
    session.value = await openFromTemplate({
      fileName: `${document.name}.docx`,
      title: document.name,
      blocks: buildDocumentBlocks(document),
    })
    statusMessage.value = `正在加载「${document.name}」…`
  } catch (error) {
    session.value = null
    loadError.value = error instanceof Error ? error.message : '打开文档失败'
    statusMessage.value = loadError.value
  } finally {
    isOpening.value = false
  }
}

function handleEditorReady() {
  isEditorReady.value = true
  statusMessage.value = `「${documentItem.value?.name || session.value?.fileName}」已就绪，正在进行 AI 分析…`
  void runAiAnalysis()
}

async function runAiAnalysis() {
  if (!documentItem.value) return
  isAnalyzing.value = true
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 800))
    analysis.value = buildAiAnalysis(documentItem.value)
    statusMessage.value = 'AI 分析完成。可写入文档，或对选区使用改写 / 扩写 / 润色'
    const autoWriteKey = `aidoc-ai-autowrite-${documentItem.value.id}`
    if (!window.sessionStorage.getItem(autoWriteKey)) {
      await new Promise((resolve) => window.setTimeout(resolve, 400))
      if (writeAnalysisToDocument()) window.sessionStorage.setItem(autoWriteKey, '1')
    }
  } finally {
    isAnalyzing.value = false
  }
}

function writeAnalysisToDocument() {
  if (!analysis.value || !editorRef.value) return false
  const sent = Boolean(editorRef.value.pasteHtml(analysis.value.html))
  statusMessage.value = sent ? '已将 AI 分析写入当前文档' : '写入失败，请确认编辑器已就绪'
  return sent
}

function cancelAiStream() {
  if (!isAiStreaming.value) return
  activeAiStreamId += 1
  activeAiEventSource?.close()
  activeAiEventSource = null
  resolveActiveAiStream?.()
  resolveActiveAiStream = null
  isAiStreaming.value = false
  statusMessage.value = '已停止 AI 流式插入'
}

async function simulateAiStream() {
  if (!isEditorReady.value || isAiStreaming.value || isAiToolRunning.value) return

  const streamId = ++activeAiStreamId
  let streamedText = ''
  isAiStreaming.value = true
  statusMessage.value = 'AI 正在流式生成，完成后将一次性写入 Collabora…'
  const eventSource = new EventSource(
    `/api/ai/stream-demo?text=${encodeURIComponent(analysis.value?.streamText || '这是ai流式返回的文字，查看效果。')}`,
  )
  activeAiEventSource = eventSource

  try {
    await new Promise<void>((resolve, reject) => {
      resolveActiveAiStream = resolve

      eventSource.addEventListener('delta', (event: Event) => {
        if (streamId !== activeAiStreamId) return

        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as { delta?: unknown }
          const delta = typeof payload.delta === 'string' ? payload.delta : ''
          if (!delta) return

          streamedText += delta
          statusMessage.value = `AI 流式返回：${streamedText}`
        } catch (error) {
          eventSource.close()
          reject(error)
        }
      })

      eventSource.addEventListener('done', (event: Event) => {
        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as { text?: unknown }
          const completedText = typeof payload.text === 'string' ? payload.text : streamedText
          if (!completedText) throw new Error('AI 没有返回可写入的文字')
          if (!editorRef.value?.insertText(completedText)) throw new Error('Collabora 编辑器未就绪')

          eventSource.close()
          resolve()
        } catch (error) {
          eventSource.close()
          reject(error)
        }
      })

      eventSource.onerror = () => {
        eventSource.close()
        reject(new Error('模拟 AI 流式接口连接中断'))
      }
    })

    if (streamId !== activeAiStreamId) return
    statusMessage.value = 'AI 流式生成完成，完整内容已一次性写入 Collabora，可点击保存更改'
  } catch (error) {
    if (streamId === activeAiStreamId) {
      statusMessage.value = error instanceof Error ? `AI 流式插入失败：${error.message}` : 'AI 流式插入失败'
    }
  } finally {
    if (activeAiEventSource === eventSource) activeAiEventSource = null
    if (streamId === activeAiStreamId) {
      resolveActiveAiStream = null
      isAiStreaming.value = false
    }
  }
}

type MockAiTool = 'generate-toc' | SelectionAiToolId

const MOCK_TOC_HTML = `
  <h2 style="margin: 0 0 12pt 0;">目录</h2>
  <p style="margin: 4pt 0 4pt 0;"><strong>1. 项目背景与目标</strong></p>
  <p style="margin: 3pt 0 3pt 28pt;">1.1 项目背景</p>
  <p style="margin: 3pt 0 3pt 28pt;">1.2 建设目标</p>
  <p style="margin: 3pt 0 3pt 28pt;">1.3 应用范围</p>
  <p style="margin: 4pt 0 4pt 0;"><strong>2. 核心功能设计</strong></p>
  <p style="margin: 3pt 0 3pt 28pt;">2.1 文档协同编辑</p>
  <p style="margin: 3pt 0 3pt 28pt;">2.2 AI 文本处理</p>
  <p style="margin: 3pt 0 3pt 56pt;">2.2.1 流式生成</p>
  <p style="margin: 3pt 0 3pt 56pt;">2.2.2 选区优化</p>
  <p style="margin: 3pt 0 3pt 28pt;">2.3 文档保存与导出</p>
  <p style="margin: 4pt 0 4pt 0;"><strong>3. Collabora 集成方案</strong></p>
  <p style="margin: 3pt 0 3pt 28pt;">3.1 iframe 嵌入</p>
  <p style="margin: 3pt 0 3pt 28pt;">3.2 WOPI 文件服务</p>
  <p style="margin: 3pt 0 3pt 28pt;">3.3 PostMessage 通信</p>
  <p style="margin: 4pt 0 4pt 0;"><strong>4. AI 文档处理流程</strong></p>
  <p style="margin: 3pt 0 3pt 28pt;">4.1 请求与上下文</p>
  <p style="margin: 3pt 0 3pt 28pt;">4.2 工具调用与审批</p>
  <p style="margin: 4pt 0 4pt 0;"><strong>5. 实施计划与风险控制</strong></p>
  <p style="margin: 3pt 0 3pt 28pt;">5.1 阶段计划</p>
  <p style="margin: 3pt 0 3pt 28pt;">5.2 风险与应对措施</p>
`
const MOCK_ILLUSTRATION_HTML =
  '<p style="margin:12pt 0;padding:28px 16px;border:1px dashed #94a3b8;border-radius:8px;background:#f8fafc;color:#64748b;text-align:center;">【AI 配图占位】已根据当前选区生成示意图，可替换为正式图片。</p>'

const SELECTION_AI_RESULTS: Record<SelectionAiToolId, string> = {
  'aidoc-rewrite': '围绕既定目标，本文以更清晰的结构说明了业务背景、技术路径与实施安排，便于后续协同修订。',
  'aidoc-expand':
    '围绕既定目标，本文补充了业务背景、约束条件与实施路径。通过明确分工、阶段节奏和质量门禁，团队可以在协同编辑中持续完善内容，并保留可追溯的修订记录。',
  'aidoc-condense': '本文说明了项目目标、关键路径与实施安排，便于协同推进。',
  'aidoc-polish': '本项目围绕核心业务目标展开，通过清晰的技术架构和可控的实施流程，提高文档协作与智能处理效率。',
  'aidoc-summary': '摘要：项目以协同编辑与智能处理为核心，覆盖文档接入、在线编辑、保存回写与导出，形成可落地的实施路径。',
  'aidoc-terms':
    '本项目围绕 WOPI Host、Collabora Online 与选区上下文工具，统一“文档、选区、修订、保存回写”等术语表述，避免混用。',
  'aidoc-illustration': '',
}

const SELECTION_AI_STATUS: Record<SelectionAiToolId, { running: string; done: string }> = {
  'aidoc-rewrite': { running: 'AI 正在改写当前选区…', done: '已用改写结果替换当前选区' },
  'aidoc-expand': { running: 'AI 正在扩写当前选区…', done: '已用扩写结果替换当前选区' },
  'aidoc-condense': { running: 'AI 正在缩写当前选区…', done: '已用缩写结果替换当前选区' },
  'aidoc-polish': { running: 'AI 正在润色当前选区…', done: '已用润色结果替换当前选区' },
  'aidoc-summary': { running: 'AI 正在提炼摘要…', done: '已将摘要写入当前选区' },
  'aidoc-terms': { running: 'AI 正在按术语规范改写…', done: '已用规范术语替换当前选区' },
  'aidoc-illustration': { running: 'AI 正在根据选区生成配图…', done: '已在当前位置插入配图占位' },
}

function handleContextualAction(id: string) {
  if (!isSelectionAiToolId(id)) return
  void runMockAiTool(id)
}

async function runMockAiTool(tool: MockAiTool) {
  if (!isEditorReady.value || isAiStreaming.value || isAiToolRunning.value || !session.value) return

  if (isSelectionAiToolId(tool)) {
    const selection = (await editorRef.value?.getTextSelection()) ?? ''
    const clicked = SELECTION_AI_TOOLS.find((item) => item.id === tool)
    console.log('选区文字:', selection)
    console.log('点击方法:', clicked?.label ?? tool)
  }

  const toolId = ++activeAiToolId
  isAiToolRunning.value = true
  statusMessage.value =
    tool === 'generate-toc' ? 'AI 正在分析文档结构并生成目录…' : SELECTION_AI_STATUS[tool].running

  try {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 900))
    if (toolId !== activeAiToolId) return

    let sent = false
    if (tool === 'generate-toc') {
      sent = Boolean(editorRef.value?.pasteHtml(MOCK_TOC_HTML))
    } else if (tool === 'aidoc-illustration') {
      sent = Boolean(editorRef.value?.pasteHtml(MOCK_ILLUSTRATION_HTML))
    } else {
      sent = Boolean(editorRef.value?.replaceSelection(SELECTION_AI_RESULTS[tool]))
    }

    if (!sent) throw new Error('Collabora 编辑器未就绪')
    statusMessage.value = tool === 'generate-toc' ? 'AI 模拟目录已插入当前光标位置' : SELECTION_AI_STATUS[tool].done
  } catch (error) {
    if (toolId === activeAiToolId) {
      statusMessage.value = error instanceof Error ? `AI 工具执行失败：${error.message}` : 'AI 工具执行失败'
    }
  } finally {
    if (toolId === activeAiToolId) isAiToolRunning.value = false
  }
}

function saveDocument() {
  statusMessage.value = editorRef.value?.save()
    ? '正在将文档保存回 WOPI 文件存储…'
    : '编辑器尚未就绪，请稍后再试'
}

function handleExportFormats(formats: CollaboraExportFormat[]) {
  exportFormats.value = formats
  const preferredFormat = formats.find(({ format }) => format === 'pdf') ?? formats[0]
  selectedExportFormat.value = preferredFormat?.format ?? ''
}

function exportDocument() {
  if (!selectedExportFormat.value) {
    statusMessage.value = '当前文档没有可用的导出格式'
    return
  }

  statusMessage.value = editorRef.value?.exportAs(selectedExportFormat.value)
    ? `正在导出 ${selectedExportFormat.value.toUpperCase()}，请留意浏览器下载…`
    : '编辑器尚未就绪，请稍后再试'
}

async function handleSaved() {
  isModified.value = false
  if (!session.value) return
  try {
    session.value = await refreshFileStatus(session.value)
    statusMessage.value = `保存成功，当前文件版本 v${session.value.version}`
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : '文档已保存'
  }
}

watch(isAiProcessing, (locked) => {
  postChatboxStatus(locked)
  if (!locked) return
  void nextTick(() => {
    const frame = document.querySelector('.editor-area iframe') as HTMLIFrameElement | null
    frame?.blur()
    window.focus()
  })
})

function chatboxContext(): ChatboxDocumentContext | null {
  if (!documentItem.value) return null
  return {
    id: documentItem.value.id,
    name: documentItem.value.name,
    type: documentItem.value.type,
    major: documentItem.value.major,
    status: documentItem.value.status,
    goal: documentItem.value.goal,
    description: documentItem.value.description,
  }
}

function chatboxTargetOrigin() {
  try {
    return new URL(chatboxUrl.value, window.location.origin).origin
  } catch {
    return window.location.origin
  }
}

function postToChatbox(payload: Record<string, unknown>) {
  chatIframeRef.value?.contentWindow?.postMessage(
    { source: HOST_SOURCE, ...payload },
    chatboxTargetOrigin(),
  )
}

function syncChatboxContext() {
  postToChatbox({
    type: 'context',
    document: chatboxContext(),
    editorReady: isEditorReady.value,
  })
}

function postChatboxStatus(processing: boolean) {
  postToChatbox({ type: 'ai-status', processing })
}

async function handleChatboxTool(tool: string) {
  if (tool === 'stream') {
    await simulateAiStream()
    return
  }
  if (tool === 'write-analysis') {
    if (!analysis.value && documentItem.value) analysis.value = buildAiAnalysis(documentItem.value)
    writeAnalysisToDocument()
    return
  }
  if (tool === 'generate-toc' || isSelectionAiToolId(tool)) {
    await runMockAiTool(tool)
  }
}

function handleChatboxMessage(event: MessageEvent) {
  if (event.origin !== chatboxTargetOrigin()) return
  if (event.source !== chatIframeRef.value?.contentWindow) return
  if (!isChatboxToHostMessage(event.data)) return

  if (event.data.type === 'ready') {
    syncChatboxContext()
    postChatboxStatus(isAiProcessing.value)
    return
  }

  if (event.data.type === 'run-tool' && typeof event.data.tool === 'string') {
    void handleChatboxTool(event.data.tool)
  }
}

watch([documentItem, isEditorReady], () => {
  syncChatboxContext()
})

onMounted(() => {
  window.addEventListener('message', handleChatboxMessage)
  void openListedDocument()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleChatboxMessage)
  activeAiStreamId += 1
  activeAiToolId += 1
  activeAiEventSource?.close()
  resolveActiveAiStream?.()
})
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand">
        <a class="back-btn" :href="AIDOC_PATH" title="返回列表" aria-label="返回列表">
          <LeftOutlined />
        </a>
        <span class="brand-divider" aria-hidden="true" />
        <div class="brand-text">
          <h1 :title="documentItem?.name">{{ documentItem?.name || '文档编辑' }}</h1>
          <p v-if="documentItem">{{ documentItem.type }} · {{ documentItem.major }} · {{ documentItem.status }}</p>
        </div>
      </div>
      <div
        v-if="session && isAiProcessing"
        class="ai-status"
        role="status"
        aria-live="polite"
      >
        <span class="ai-status-dot" aria-hidden="true" />
        AI 处理中
      </div>
      <div v-if="session" class="external-actions">
        <!-- <NButton class="secondary-btn" :disabled="!isEditorReady || isAiToolRunning || isAnalyzing" @click="isAiStreaming ? cancelAiStream() : simulateAiStream()">
          {{ isAiStreaming ? '停止流式' : '模拟 AI 流式' }}
        </NButton> -->
        <div class="header-export">
          <NSelect
            id="export-format"
            v-model:value="selectedExportFormat"
            :options="exportFormatOptions"
            :placeholder="isEditorReady ? '选择格式' : '连接中…'"
            :disabled="!isEditorReady || !exportFormats.length || isAiProcessing"
          />
          <NButton class="secondary-btn" :disabled="!isEditorReady || !selectedExportFormat || isAiProcessing" @click="exportDocument">导出</NButton>
        </div>
        <NButton type="primary" class="primary-btn" :disabled="!isEditorReady || isAiProcessing" @click="saveDocument">{{ isModified ? '保存更改' : '强制保存' }}</NButton>
      </div>
    </header>

    <section class="workspace">
      <div class="editor-area" :class="{ 'is-ai-locked': isAiProcessing }" :aria-busy="isAiProcessing">
        <CollaboraEditor
          v-if="session"
          :key="session.fileId"
          ref="editorRef"
          :session="session"
          :collabora-url="collaboraUrl"
          @ready="handleEditorReady"
          @status="statusMessage = $event"
          @saved="handleSaved"
          @modified="isModified = $event"
          @export-formats="handleExportFormats"
          @error="statusMessage = $event"
          @contextual-action="handleContextualAction"
        />
        <div
          v-if="session && isAiProcessing"
          class="editor-lock"
          @mousedown.prevent
        >
          <span>{{ isAiStreaming ? 'AI 正在写入文档，编辑已暂停' : 'AI 正在处理文档，编辑已暂停' }}</span>
        </div>
        <div v-else-if="!session" class="empty-state">
          <div class="document-icon">{{ isOpening ? '…' : 'W' }}</div>
          <h2>{{ isOpening ? '正在打开文档' : '还没有可编辑的文档' }}</h2>
          <p>{{ loadError || '请从文档列表进入，系统会按该文档的名称、目标和说明生成一份可编辑的 Word。' }}</p>
          <a class="primary-btn large" :href="AIDOC_PATH" style="display:inline-flex;align-items:center;text-decoration:none;">返回文档列表</a>
        </div>
      </div>

      <aside class="side-panel">
        <iframe
          ref="chatIframeRef"
          class="chatbox-frame"
          :src="chatboxUrl"
          title="AI 对话助手"
          @load="syncChatboxContext"
        />
      </aside>
    </section>
  </main>
</template>
