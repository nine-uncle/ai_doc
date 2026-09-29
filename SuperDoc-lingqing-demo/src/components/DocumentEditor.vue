<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { SuperDoc, BlankDOCX, DOCX, getFileObject } from 'superdoc'
import { superdocFonts } from '@superdoc-dev/fonts'
import type { BorrowedSuperDocUI, SelectionCapture } from 'superdoc/ui'
import DirectoryTree from '@/components/DirectoryTree.vue'
import EditorToolbar from '@/components/EditorToolbar.vue'
import SelectionToolbar from '@/components/SelectionToolbar.vue'
import type { AiDocumentAction } from '@/types/aiAction'
import type { FlatTocNode, TocNode } from '@/types/document'
import {
  collectTocIds,
  extractTocHeadingTitles,
  updateHeadingTitleById,
  buildFlatTocFromHeadings,
  ensureHeadingBookmarks,
  navigateToHeadingAnchor,
} from '@/utils/headingSync'
import { insertHtmlChunk, type SuperDocContentDoc } from '@/utils/superdocContent'
import { exportSuperDocAsDocx, resolveDocxExportName } from '@/utils/docxExport'
import type { SuperDocHeadingDoc } from '@/utils/headingSync'

const props = defineProps<{
  content: string
  tocTree: TocNode[]
  headingSyncFromToc: { id: string; title: string } | null
  activeNodeId: string | null
  activeAnnotationId: string | null
  editable: boolean
  isStreaming: boolean
  isTocStreaming: boolean
  loadingAction: AiDocumentAction | null
  uploadedDocxFile: File | null
  documentLoadToken: number
}>()

const emit = defineEmits<{
  'select-toc': [id: string]
  'update-toc-title': [id: string, title: string]
  'select-annotation': [id: string]
  'ai-action': [action: AiDocumentAction, text: string, from: number, to: number]
  'heading-titles-change': [titles: Record<string, string>]
  'heading-sync-applied': []
  'document-processed': [flatToc: FlatTocNode[]]
  'document-process-failed': [message: string]
  'export-docx-success': [fileName: string]
  'export-docx-failed': [message: string]
}>()

const tocIds = computed(() => collectTocIds(props.tocTree))
const documentPageRef = ref<HTMLElement | null>(null)
const superdocContainerRef = ref<HTMLElement | null>(null)
const selectionToolbarLayerRef = ref<HTMLElement | null>(null)
const superdocUi = shallowRef<BorrowedSuperDocUI | null>(null)
const isSuperdocReady = ref(false)
const isExportingDocx = ref(false)
const tocExpanded = ref(true)
const headingBlockById = ref<Record<string, string>>({})
const selectionToolbarVisible = ref(false)
const selectionToolbarStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

let superdocInstance: SuperDoc | null = null
let lastContentLength = 0
let isApplyingTocSync = false
let selectionCapture: SelectionCapture | null = null
let stopSelectionObserver: (() => void) | null = null
let stopViewportObserver: (() => void) | null = null
let removeHostClickHandler: (() => void) | null = null
let removeSelectionRepositionListeners: (() => void) | null = null
let headingSyncTimer: ReturnType<typeof setTimeout> | null = null
let layoutFitObserver: ResizeObserver | null = null

const FIT_WIDTH_MIN = 60
const FIT_WIDTH_MAX = 320
const FIT_WIDTH_PADDING = 8
/** DOCX 默认纸页逻辑宽度（8.5in @ 96dpi）；DOM 上仍为固定 px，视觉宽度由 zoom 缩放 */
const DOC_PAGE_WIDTH_PX = 816

function clampFitZoom(zoom: number): number {
  return Math.min(FIT_WIDTH_MAX, Math.max(FIT_WIDTH_MIN, zoom))
}

function resolveDocumentWidthPx(): number {
  const metrics = superdocInstance?.getViewportMetrics()
  const width = metrics?.documentWidth
  return width && width > 0 ? width : DOC_PAGE_WIDTH_PX
}

function resolveFitContainerWidth(): number {
  const shell = documentPageRef.value
  if (shell && shell.clientWidth > 0) return shell.clientWidth

  const host = superdocContainerRef.value
  return host?.clientWidth ?? 0
}

/** 按容器可用宽度百分比计算 zoom，使纸页视觉宽度随容器自适应 */
function computeContainerFitZoom(containerWidth: number): number {
  const available = Math.max(0, containerWidth - FIT_WIDTH_PADDING * 2)
  return clampFitZoom((available / resolveDocumentWidthPx()) * 100)
}

function syncPageFitToContainer() {
  if (!superdocInstance) return

  const containerWidth = resolveFitContainerWidth()
  if (containerWidth <= 0) return

  const zoom = computeContainerFitZoom(containerWidth)
  const setPageZoom = (
    superdocInstance.activeEditor as { pageMetrics?: { setZoom?: (percent: number) => unknown } } | null
  )?.pageMetrics?.setZoom

  if (typeof setPageZoom === 'function') {
    void setPageZoom(zoom)
    return
  }

  superdocInstance.setZoom(zoom)
}

function startLayoutFitObserver() {
  layoutFitObserver?.disconnect()

  const targets = [documentPageRef.value, superdocContainerRef.value].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  )
  if (targets.length === 0) return

  layoutFitObserver = new ResizeObserver(() => {
    syncPageFitToContainer()
  })
  targets.forEach((target) => layoutFitObserver?.observe(target))
  syncPageFitToContainer()
}

function stopLayoutFitObserver() {
  layoutFitObserver?.disconnect()
  layoutFitObserver = null
}

function schedulePageFitSync() {
  nextTick(() => {
    requestAnimationFrame(() => {
      syncPageFitToContainer()
    })
  })
}

function toggleTocPanel() {
  tocExpanded.value = !tocExpanded.value
}

function getDocumentApi(): SuperDocContentDoc & SuperDocHeadingDoc | null {
  const doc = superdocInstance?.activeEditor?.doc
  if (!doc?.insert || !doc.blocks || !doc.bookmarks || !doc.replace) return null
  return doc as SuperDocContentDoc & SuperDocHeadingDoc
}

function resolveDocumentMode(): 'editing' | 'viewing' {
  // 流式写入依赖 Document API，viewing 模式下 insert 会被拒绝
  if (props.isStreaming || props.editable) return 'editing'
  return 'viewing'
}

function setDocumentMode() {
  superdocInstance?.setDocumentMode(resolveDocumentMode())
}

const SELECTION_TOOLBAR_GAP = 8
const SELECTION_TOOLBAR_PADDING = 8

function applySelectionToolbarStyle(
  shell: HTMLElement,
  rect: { top: number; left: number; width: number; bottom: number },
) {
  const layer = selectionToolbarLayerRef.value
  const toolbarWidth = layer?.offsetWidth ?? 320
  const toolbarHeight = layer?.offsetHeight ?? 44

  let centerX = rect.left + rect.width / 2
  let top = rect.top - toolbarHeight - SELECTION_TOOLBAR_GAP

  if (top < SELECTION_TOOLBAR_PADDING) {
    top = rect.bottom + SELECTION_TOOLBAR_GAP
  }

  const halfWidth = toolbarWidth / 2
  const maxCenterX = shell.clientWidth - halfWidth - SELECTION_TOOLBAR_PADDING
  const minCenterX = halfWidth + SELECTION_TOOLBAR_PADDING
  centerX = Math.min(maxCenterX, Math.max(minCenterX, centerX))

  const maxTop = shell.clientHeight - toolbarHeight - SELECTION_TOOLBAR_PADDING
  top = Math.min(maxTop, Math.max(SELECTION_TOOLBAR_PADDING, top))

  selectionToolbarStyle.value = {
    left: `${centerX}px`,
    top: `${top}px`,
  }
}

function positionSelectionToolbar() {
  const ui = superdocUi.value
  const shell = documentPageRef.value
  if (!ui || !shell || !selectionCapture) {
    selectionToolbarVisible.value = false
    return
  }

  const target = selectionCapture.selectionTarget ?? selectionCapture.target
  if (!target) {
    selectionToolbarVisible.value = false
    return
  }

  const geometry = ui.viewport.getRect({ target, relativeTo: shell })
  if (!geometry.found || !geometry.rect) {
    selectionToolbarVisible.value = false
    return
  }

  selectionToolbarVisible.value = true
  applySelectionToolbarStyle(shell, geometry.rect)

  nextTick(() => {
    if (!selectionToolbarVisible.value || !geometry.rect) return
    applySelectionToolbarStyle(shell, geometry.rect)
  })
}

function bindSelectionRepositionListeners(ui: BorrowedSuperDocUI) {
  removeSelectionRepositionListeners?.()

  const shell = documentPageRef.value
  const host = ui.viewport.getHost()
  const onReposition = () => {
    if (selectionCapture) positionSelectionToolbar()
  }

  shell?.addEventListener('scroll', onReposition, { passive: true })
  host?.addEventListener('scroll', onReposition, { passive: true })

  removeSelectionRepositionListeners = () => {
    shell?.removeEventListener('scroll', onReposition)
    host?.removeEventListener('scroll', onReposition)
  }
}

function bindSelectionToolbar(ui: BorrowedSuperDocUI) {
  stopSelectionObserver?.()
  stopViewportObserver?.()
  bindSelectionRepositionListeners(ui)

  const handleSelection = () => {
    if (!props.editable) {
      selectionToolbarVisible.value = false
      selectionCapture = null
      return
    }

    const snapshot = ui.selection.getSnapshot()
    if (snapshot.empty) {
      selectionToolbarVisible.value = false
      selectionCapture = null
      return
    }

    selectionCapture = ui.selection.capture()
    positionSelectionToolbar()
  }

  handleSelection()
  stopSelectionObserver = ui.selection.observe(handleSelection)
  stopViewportObserver = ui.viewport.observe(() => {
    if (selectionCapture) positionSelectionToolbar()
  })
}

function bindAnnotationClicks(ui: BorrowedSuperDocUI) {
  removeHostClickHandler?.()
  const host = ui.viewport.getHost()
  if (!host) return

  const onClick = (event: MouseEvent) => {
    const target = (event.target as HTMLElement | null)?.closest('[data-annotation-id]')
    if (!target) return

    const id = target.getAttribute('data-annotation-id')
    if (id) {
      emit('select-annotation', id)
    }
  }

  host.addEventListener('click', onClick)
  removeHostClickHandler = () => host.removeEventListener('click', onClick)
}

function syncActiveAnnotationClass() {
  const host = superdocUi.value?.viewport.getHost()
  if (!host) return

  host.querySelectorAll('[data-annotation-id]').forEach((el) => {
    el.classList.remove('is-active')
  })

  if (!props.activeAnnotationId) return

  const active = host.querySelector(
    `[data-annotation-id="${CSS.escape(props.activeAnnotationId)}"]`,
  )
  active?.classList.add('is-active')
}

async function resetSuperdocDocument() {
  if (!superdocInstance) return

  lastContentLength = 0
  headingBlockById.value = {}
  const blankFile = await getFileObject(BlankDOCX, 'blank.docx', DOCX)
  await superdocInstance.replaceFile(blankFile)

  if (props.isStreaming) {
    schedulePageFitSync()
  }
}

async function waitForDocumentApi(retries = 24): Promise<ReturnType<typeof getDocumentApi>> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const doc = getDocumentApi()
    if (doc) return doc
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 120)
    })
  }
  return null
}

async function processUploadedDocx(file: File) {
  if (!superdocInstance) return

  lastContentLength = 0

  try {
    await superdocInstance.replaceFile(file)
    schedulePageFitSync()

    const doc = await waitForDocumentApi()
    if (!doc) {
      emit('document-process-failed', 'SuperDoc 文档 API 尚未就绪')
      return
    }

    const flatToc = await buildFlatTocFromHeadings(doc)
    await ensureHeadingBookmarks(doc, flatToc)
    headingBlockById.value = Object.fromEntries(
      flatToc.flatMap((item) => (item.blockNodeId ? [[item.id, item.blockNodeId] as const] : [])),
    )
    emit('document-processed', flatToc)
  } catch (error) {
    emit(
      'document-process-failed',
      error instanceof Error ? error.message : '加载 Word 文档失败',
    )
  }
}

async function appendContentDelta(fullHtml: string) {
  if (!fullHtml) {
    if (lastContentLength > 0) {
      await resetSuperdocDocument()
    }
    return
  }

  const doc = getDocumentApi()
  if (!doc) return

  if (fullHtml.length < lastContentLength) {
    await resetSuperdocDocument()
  }

  const delta = fullHtml.slice(lastContentLength)
  if (!delta) return

  lastContentLength = fullHtml.length

  try {
    await insertHtmlChunk(doc, delta)
    syncActiveAnnotationClass()

    if (props.isStreaming) {
      nextTick(() => scrollToBottom())
    }
  } catch (error) {
    lastContentLength -= delta.length
    console.error('[DocumentEditor] Failed to append SuperDoc content chunk:', error)
  }
}

async function flushContent(fullHtml: string) {
  await appendContentDelta(fullHtml || '')
}

function scheduleHeadingTitlesSync() {
  if (headingSyncTimer) clearTimeout(headingSyncTimer)

  headingSyncTimer = setTimeout(async () => {
    headingSyncTimer = null
    if (isApplyingTocSync || !props.editable) return

    const doc = getDocumentApi()
    if (!doc) return

    const titles = await extractTocHeadingTitles(doc, tocIds.value)
    emit('heading-titles-change', titles)
  }, 280)
}

async function scrollToAnchor(id: string) {
  if (!superdocInstance) return

  await navigateToHeadingAnchor({
    doc: getDocumentApi(),
    viewport: superdocUi.value?.viewport ?? null,
    navigator: superdocInstance,
    id,
    blockNodeIdById: headingBlockById.value,
  })
}

function handleTocSelect(id: string) {
  emit('select-toc', id)
  void scrollToAnchor(id)
}

async function exportDocx() {
  if (!superdocInstance || isExportingDocx.value || !isSuperdocReady.value) return

  const exportedName = resolveDocxExportName(props.uploadedDocxFile?.name)

  isExportingDocx.value = true
  try {
    await exportSuperDocAsDocx(superdocInstance, {
      exportedName,
      triggerDownload: true,
    })
    emit('export-docx-success', `${exportedName}.docx`)
  } catch (error) {
    const message = error instanceof Error ? error.message : '导出 Word 文档失败'
    emit('export-docx-failed', message)
  } finally {
    isExportingDocx.value = false
  }
}

const canExportDocx = computed(
  () => isSuperdocReady.value && props.editable && !props.isStreaming && !isExportingDocx.value,
)

function scrollToBottom() {
  const page = documentPageRef.value
  page?.scrollTo({ top: page.scrollHeight, behavior: 'smooth' })
}

function handleToolbarAction(action: AiDocumentAction) {
  if (!selectionCapture) return

  const text = selectionCapture.quotedText.trim()
  if (!text) return

  emit('ai-action', action, text, 0, text.length)
}

onMounted(() => {
  if (!superdocContainerRef.value) return

  superdocInstance = new SuperDoc({
    selector: superdocContainerRef.value,
    document: BlankDOCX,
    documentMode: resolveDocumentMode(),
    ui: false,
    contained: true,
    fonts: superdocFonts as never,
    comments: { visible: false },
    user: {
      name: '灵清用户',
      email: 'demo@lingqing.local',
    },
    zoom: {
      initial: 100,
      mode: 'fit-width',
      fitWidth: {
        min: FIT_WIDTH_MIN,
        max: FIT_WIDTH_MAX,
        padding: FIT_WIDTH_PADDING,
      },
    },
    onEditorCreate: () => {
      schedulePageFitSync()
    },
    onReady: ({ superdoc }) => {
      isSuperdocReady.value = true
      superdocUi.value = superdoc.ui
      bindSelectionToolbar(superdoc.ui)
      bindAnnotationClicks(superdoc.ui)
      startLayoutFitObserver()
      schedulePageFitSync()
      window.setTimeout(schedulePageFitSync, 120)
      window.setTimeout(schedulePageFitSync, 480)
      void flushContent(props.content)
    },
    onEditorUpdate: () => {
      scheduleHeadingTitlesSync()
      if (!props.isStreaming) schedulePageFitSync()
    },
    onContentError: ({ error }) => {
      console.error('[DocumentEditor] SuperDoc content error:', error)
    },
    onException: ({ error }) => {
      console.error('[DocumentEditor] SuperDoc exception:', error)
    },
  })
})

watch(
  () => props.content,
  (html) => {
    if (!isSuperdocReady.value) return
    void flushContent(html || '')
  },
)

watch(
  () => props.documentLoadToken,
  (token) => {
    if (!token || !props.uploadedDocxFile || !isSuperdocReady.value) return
    void processUploadedDocx(props.uploadedDocxFile)
  },
)

watch(
  () => props.isStreaming,
  (streaming, wasStreaming) => {
    if (streaming) {
      schedulePageFitSync()
      return
    }

    if (wasStreaming) {
      schedulePageFitSync()
    }
  },
)

watch(
  () => tocExpanded.value,
  () => {
    schedulePageFitSync()
    window.setTimeout(schedulePageFitSync, 240)
    if (selectionCapture) {
      nextTick(() => positionSelectionToolbar())
      window.setTimeout(() => positionSelectionToolbar(), 260)
    }
  },
)

watch(
  () => [props.editable, props.isStreaming] as const,
  () => {
    setDocumentMode()
  },
)

watch(
  () => props.headingSyncFromToc,
  (payload) => {
    if (!payload) return

    void (async () => {
      const doc = getDocumentApi()
      if (!doc) return

      isApplyingTocSync = true
      await updateHeadingTitleById(doc, payload.id, payload.title)
      isApplyingTocSync = false
      emit('heading-sync-applied')
    })()
  },
)

watch(
  () => props.activeAnnotationId,
  () => {
    syncActiveAnnotationClass()
  },
)

defineExpose({ scrollToAnchor, exportDocx })

onBeforeUnmount(() => {
  if (headingSyncTimer) clearTimeout(headingSyncTimer)
  stopSelectionObserver?.()
  stopViewportObserver?.()
  removeHostClickHandler?.()
  removeSelectionRepositionListeners?.()
  isSuperdocReady.value = false
  stopLayoutFitObserver()
  superdocInstance?.destroy()
  superdocInstance = null
  superdocUi.value = null
})
</script>

<template>
  <section class="document-editor">
    <EditorToolbar
      :ui="superdocUi"
      :get-document-api="getDocumentApi"
      :disabled="!editable"
      :can-export="canExportDocx"
      :exporting="isExportingDocx"
      @export-docx="exportDocx"
    />

    <div class="editor-scroll">
      <div class="canvas-layout" :class="{ 'toc-collapsed': !tocExpanded }">
        <aside class="toc-panel" :class="{ collapsed: !tocExpanded }">
          <DirectoryTree
            :nodes="tocTree"
            :active-node-id="activeNodeId"
            :is-streaming="isTocStreaming"
            @select="handleTocSelect"
            @update-title="(id, title) => emit('update-toc-title', id, title)"
          />
        </aside>

        <button
          type="button"
          class="toc-toggle"
          :title="tocExpanded ? '收起目录' : '展开目录'"
          @click="toggleTocPanel"
        >
          <span class="toc-toggle-icon">{{ tocExpanded ? '‹' : '›' }}</span>
          <span v-if="!tocExpanded" class="toc-toggle-label">目录</span>
        </button>

        <div ref="documentPageRef" class="document-page document-page-shell">
          <div ref="superdocContainerRef" class="superdoc-host" />
          <div
            v-if="selectionToolbarVisible"
            ref="selectionToolbarLayerRef"
            class="selection-toolbar-layer"
            :style="selectionToolbarStyle"
          >
            <SelectionToolbar :loading-action="loadingAction" @action="handleToolbarAction" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.document-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: transparent;
}

.editor-scroll {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 12px;
  background: #f5f7f9;
}

.canvas-layout {
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 100%;
  margin: 0;
}

.canvas-layout.toc-collapsed {
  position: relative;
}

.canvas-layout.toc-collapsed .toc-toggle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 1;
}

.toc-panel {
  width: 280px;
  flex-shrink: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #fff;
  border-radius: 2px;
  box-shadow:
    0 1px 2px rgb(15 23 42 / 5%),
    0 8px 24px rgb(15 23 42 / 6%);
  transition: width 0.22s ease, box-shadow 0.22s ease;
}

.toc-panel.collapsed {
  width: 0;
  box-shadow: none;
}

.toc-toggle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 24px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}

.toc-toggle:hover {
  color: #2563eb;
}

.toc-toggle-icon {
  font-size: 18px;
  line-height: 1;
}

.toc-toggle-label {
  writing-mode: vertical-rl;
  font-size: 12px;
  letter-spacing: 2px;
}

.document-page {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: auto;
  margin: 0;
  padding: 0;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.document-page::-webkit-scrollbar {
  width: 6px;
}

.document-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgb(148 163 184 / 45%);
}

.superdoc-host {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.superdoc-host :deep(.superdoc) {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: transparent;
}

.superdoc-host :deep(.superdoc__layers) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.superdoc-host :deep(.superdoc__sub-document) {
  width: 100%;
  min-height: 100%;
}

.superdoc-host :deep(.superdoc__document) {
  width: 100%;
  margin-inline: auto;
}

/* 816px 为 DOCX 逻辑纸宽；视觉缩放由 pageMetrics.setZoom 控制 */
.superdoc-host :deep(.superdoc-page) {
  margin-inline: auto;
  box-sizing: border-box;
}

.selection-toolbar-layer {
  position: absolute;
  z-index: 20;
  transform: translateX(-50%);
  pointer-events: auto;
}

:deep(.superdoc-host .doc-annotation.is-active) {
  background: rgb(68 125 253 / 14%);
}

:deep(.superdoc-host .doc-annotation:hover) {
  background: rgb(68 125 253 / 8%);
}
</style>
