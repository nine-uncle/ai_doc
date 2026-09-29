<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import type { JSONContent } from '@tiptap/core'
import { createDocxEditorExtensions } from '@/extensions/editorExtensions'

const editorExtensions = createDocxEditorExtensions()
import DirectoryTree from '@/components/DirectoryTree.vue'
import EditorToolbar from '@/components/EditorToolbar.vue'
import SelectionToolbar from '@/components/SelectionToolbar.vue'
import type { AiDocumentAction } from '@/types/aiAction'
import type { TocNode } from '@/types/document'
import {
  collectTocIds,
  extractTocHeadingTitles,
  updateHeadingTitleById,
} from '@/utils/headingSync'
import { createEmptyDoc } from '@/utils/docxDocument'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

const props = defineProps<{
  content: JSONContent | null
  tocTree: TocNode[]
  headingSyncFromToc: { id: string; title: string } | null
  activeNodeId: string | null
  activeAnnotationId: string | null
  editable: boolean
  isStreaming: boolean
  isTocStreaming: boolean
  loadingAction: AiDocumentAction | null
  observeFormat?: boolean
}>()

const emit = defineEmits<{
  'select-toc': [id: string]
  'update-toc-title': [id: string, title: string]
  'select-annotation': [id: string]
  'ai-action': [action: AiDocumentAction, text: string, from: number, to: number]
  'heading-titles-change': [titles: Record<string, string>]
  'heading-sync-applied': []
}>()

const tocIds = computed(() => collectTocIds(props.tocTree))
const documentPageRef = ref<HTMLElement | null>(null)
const tocExpanded = ref(true)
let isApplyingTocSync = false

function toggleTocPanel() {
  tocExpanded.value = !tocExpanded.value
}

const editor = useEditor({
  extensions: editorExtensions,
  content: createEmptyDoc(),
  editable: false,
  onUpdate({ editor: currentEditor }) {
    if (isApplyingTocSync || !props.editable) return
    emit('heading-titles-change', extractTocHeadingTitles(currentEditor, tocIds.value))
  },
  editorProps: {
    attributes: {
      class: 'document-editor-content',
    },
    handleClick(_view, _pos, event) {
      const target = event.target as HTMLElement
      const annotationEl = target.closest('[data-annotation-id]')
      if (!annotationEl) return false

      const id = annotationEl.getAttribute('data-annotation-id')
      if (id) {
        emit('select-annotation', id)
        return true
      }

      return false
    },
  },
})

function appendToBody() {
  return document.body
}

function shouldShowSelectionToolbar({
  editor: currentEditor,
}: {
  editor: Editor
  element: HTMLElement
  view: EditorView
  state: EditorState
  oldState?: EditorState
  from: number
  to: number
}) {
  if (!props.editable) return false
  const { from, to, empty } = currentEditor.state.selection
  return !empty && from !== to
}

function handleToolbarAction(action: AiDocumentAction) {
  const currentEditor = editor.value
  if (!currentEditor) return

  const { from, to, empty } = currentEditor.state.selection
  if (empty || from === to) return

  const text = currentEditor.state.doc.textBetween(from, to, ' ').trim()
  if (!text) return

  emit('ai-action', action, text, from, to)
}

watch(
  () => props.content,
  (json) => {
    if (!editor.value) return
    editor.value.commands.setContent(json ?? createEmptyDoc(), { emitUpdate: false })
    syncActiveAnnotationClass()

    if (props.isStreaming) {
      nextTick(() => scrollToBottom())
    }
  },
)

watch(
  () => props.editable,
  (editable) => {
    editor.value?.setEditable(editable)
  },
)

watch(
  () => props.activeNodeId,
  (id) => {
    if (id) scrollToAnchor(id)
  },
)

watch(
  () => props.headingSyncFromToc,
  (payload) => {
    if (!payload || !editor.value) return

    isApplyingTocSync = true
    updateHeadingTitleById(editor.value, payload.id, payload.title)
    isApplyingTocSync = false
    emit('heading-sync-applied')
  },
)

watch(
  () => props.activeAnnotationId,
  () => {
    syncActiveAnnotationClass()
  },
)

function syncActiveAnnotationClass() {
  const root = editor.value?.view.dom
  if (!root) return

  root.querySelectorAll('[data-annotation-id]').forEach((el) => {
    el.classList.remove('is-active')
  })

  if (!props.activeAnnotationId) return

  const active = root.querySelector(
    `[data-annotation-id="${CSS.escape(props.activeAnnotationId)}"]`,
  )
  active?.classList.add('is-active')
}

function scrollToAnchor(id: string) {
  const page = documentPageRef.value
  const root = editor.value?.view.dom
  if (!page || !root) return

  const target = root.querySelector(`#${CSS.escape(id)}`)
  if (!target) return

  const pageRect = page.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  page.scrollTo({
    top: page.scrollTop + (targetRect.top - pageRect.top) - 24,
    behavior: 'smooth',
  })
}

function scrollToBottom() {
  const page = documentPageRef.value
  page?.scrollTo({ top: page.scrollHeight, behavior: 'smooth' })
}

defineExpose({ scrollToAnchor })

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <section class="document-editor">
    <EditorToolbar :editor="editor" :disabled="!editable" />

    <div class="editor-scroll">
      <div class="canvas-layout" :class="{ 'toc-collapsed': !tocExpanded }">
        <aside class="toc-panel" :class="{ collapsed: !tocExpanded }">
          <DirectoryTree
            :nodes="tocTree"
            :active-node-id="activeNodeId"
            :is-streaming="isTocStreaming"
            @select="emit('select-toc', $event)"
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

        <div
          ref="documentPageRef"
          class="document-page"
          :class="{ 'observe-format': observeFormat !== false }"
        >
          <EditorContent v-if="editor" :editor="editor" />
          <div v-else class="placeholder">编辑器初始化中…</div>
        </div>
      </div>

      <BubbleMenu
        v-if="editor"
        :editor="editor"
        :append-to="appendToBody"
        :should-show="shouldShowSelectionToolbar"
        :options="{ placement: 'top', offset: 8 }"
      >
        <SelectionToolbar :loading-action="loadingAction" @action="handleToolbarAction" />
      </BubbleMenu>
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
  padding: 24px 32px;
  background: #f5f7f9;
}

.canvas-layout {
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: 1160px;
  height: 100%;
  margin: 0 auto;
}

.canvas-layout.toc-collapsed {
  position: relative;
  max-width: 100%;
  justify-content: center;
}

.canvas-layout.toc-collapsed .document-page {
  flex: 0 1 820px;
  width: 100%;
  max-width: 820px;
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
  flex: 1;
  min-width: 0;
  max-width: 820px;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  margin: 0;
  padding: 40px 48px 48px;
  background: #fff;
  border-radius: 2px;
  box-shadow:
    0 1px 2px rgb(15 23 42 / 5%),
    0 8px 24px rgb(15 23 42 / 6%);
}

.document-page::-webkit-scrollbar {
  width: 6px;
}

.document-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgb(148 163 184 / 45%);
}

.placeholder {
  color: #9ca3af;
  font-size: 13px;
}

:deep(.document-editor-content) {
  min-height: 100%;
  outline: none;
}

:deep(.document-editor-content h1),
:deep(.document-editor-content h2),
:deep(.document-editor-content h3),
:deep(.document-editor-content h4),
:deep(.document-editor-content h5),
:deep(.document-editor-content h6) {
  margin: 0 0 12px;
}

.observe-format :deep(.document-editor-content h1),
.observe-format :deep(.document-editor-content h2),
.observe-format :deep(.document-editor-content h3),
.observe-format :deep(.document-editor-content h4),
.observe-format :deep(.document-editor-content h5),
.observe-format :deep(.document-editor-content h6) {
  font-size: unset;
  font-weight: unset;
}

.document-page:not(.observe-format) :deep(.document-editor-content h1) {
  font-size: 28px;
}

.document-page:not(.observe-format) :deep(.document-editor-content h2) {
  margin-top: 28px;
  font-size: 22px;
}

.document-page:not(.observe-format) :deep(.document-editor-content h3) {
  margin-top: 20px;
  font-size: 18px;
}

:deep(.document-editor-content table) {
  width: 100%;
  margin: 0 0 12px;
  border-collapse: collapse;
}

:deep(.document-editor-content th),
:deep(.document-editor-content td) {
  border: 1px solid #d1d5db;
  padding: 6px 10px;
  vertical-align: top;
}

.observe-format :deep(.document-editor-content p),
.observe-format :deep(.document-editor-content li) {
  margin: 0;
  line-height: inherit;
  color: inherit;
}

.observe-format :deep(.document-editor-content table.docx-table) {
  width: auto;
  max-width: 100%;
}

.observe-format :deep(.document-editor-content th),
.observe-format :deep(.document-editor-content td) {
  border: none;
  padding: 4px 8px;
  vertical-align: inherit;
}

:deep(.document-editor-content img) {
  max-width: 100%;
  height: auto;
}

.document-page:not(.observe-format) :deep(.document-editor-content p),
.document-page:not(.observe-format) :deep(.document-editor-content li) {
  margin: 0 0 12px;
  line-height: 1.75;
  color: #374151;
}

:deep(.document-editor-content ul) {
  margin: 0 0 12px;
  padding-left: 20px;
}

:deep(.document-editor-content blockquote) {
  margin: 0 0 12px;
  padding: 8px 0 8px 14px;
  border-left: 3px solid #d1d5db;
  color: #4b5563;
}

:deep(.document-editor-content code) {
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: #f3f4f6;
  font-size: 0.92em;
}

:deep(.document-editor-content .doc-annotation) {
  text-decoration: underline;
  text-decoration-color: #447dfd;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

:deep(.document-editor-content .doc-annotation:hover) {
  background: rgb(68 125 253 / 8%);
}

:deep(.document-editor-content .doc-annotation.is-active) {
  background: rgb(68 125 253 / 14%);
}
</style>
