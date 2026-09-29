<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DirectoryTree from '@/components/DirectoryTree.vue'
import OnlyOfficeEditor from '@/components/OnlyOfficeEditor.vue'
import { resolveOnlyOfficeDocumentSource } from '@/services/documentSource'
import { buildOnlyOfficeConfig } from '@/services/onlyofficeConfig'
import type { TocNode } from '@/types/document'
import type { OnlyOfficeConfig } from '@/types/onlyoffice'

const props = defineProps<{
  tocTree: TocNode[]
  activeNodeId: string | null
  editable: boolean
  isTocStreaming: boolean
  uploadedDocxFile: File | null
  documentLoadToken: number
}>()

const emit = defineEmits<{
  'select-toc': [id: string]
  'update-toc-title': [id: string, title: string]
  'select-annotation': [id: string]
  'editor-ready': []
  'document-process-failed': [message: string]
}>()

const tocExpanded = ref(true)
const editorError = ref('')
const isEditorReady = ref(false)

const documentSource = computed(() =>
  resolveOnlyOfficeDocumentSource(props.uploadedDocxFile),
)

const onlyofficeConfig = computed<OnlyOfficeConfig | null>(() => {
  if (!props.documentLoadToken) return null

  const source = documentSource.value
  return buildOnlyOfficeConfig({
    documentId: 'lingqing-doc',
    documentUrl: source.url,
    documentTitle: source.title,
    mode: props.editable ? 'edit' : 'view',
    loadKey: props.documentLoadToken,
  })
})

function toggleTocPanel() {
  tocExpanded.value = !tocExpanded.value
}

function handleTocSelect(id: string) {
  emit('select-toc', id)
}

function handleEditorReady() {
  editorError.value = ''
  isEditorReady.value = true
  emit('editor-ready')
}

function handleEditorError(message: string) {
  editorError.value = message
  isEditorReady.value = false
  emit('document-process-failed', message)
}

watch(
  () => props.documentLoadToken,
  () => {
    isEditorReady.value = false
    editorError.value = ''
  },
)
</script>

<template>
  <section class="document-editor">
    <header class="editor-header">
      <div class="editor-header__info">
        <strong>ONLYOFFICE</strong>
        <span class="mode-tag">{{ editable ? '编辑' : '预览' }}</span>
        <span class="doc-name" :title="documentSource.title">{{ documentSource.title }}</span>
      </div>
      <p v-if="documentSource.usesFallback" class="editor-header__warn">
        本地文件需后端提供可访问 URL 后才能在 ONLYOFFICE 中打开，当前暂用示例文档。
      </p>
      <p v-else class="editor-header__hint">Word 级文档展示与编辑（需 Document Server）</p>
    </header>

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

        <div class="document-page">
          <div v-if="!documentLoadToken" class="document-placeholder">
            <p>请上传 Word 文档或点击「模拟 AI 处理文档」加载 ONLYOFFICE 编辑器</p>
          </div>

          <OnlyOfficeEditor
            v-else-if="onlyofficeConfig"
            :key="onlyofficeConfig.document.key"
            :config="onlyofficeConfig"
            @ready="handleEditorReady"
            @error="handleEditorError"
          />

          <div v-if="editorError" class="document-error">{{ editorError }}</div>
          <div v-else-if="documentLoadToken && !isEditorReady" class="document-loading">
            正在连接 ONLYOFFICE…
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

.editor-header {
  flex-shrink: 0;
  padding: 10px 16px;
  border-bottom: 1px solid #ebedf0;
  background: #fff;
}

.editor-header__info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #334155;
  font-size: 13px;
}

.editor-header__info strong {
  color: #0f172a;
}

.mode-tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 12px;
}

.doc-name {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
}

.editor-header__hint,
.editor-header__warn {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.editor-header__hint {
  color: #64748b;
}

.editor-header__warn {
  color: #b45309;
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
  overflow: hidden;
  margin: 0;
  background: #fff;
  border-radius: 2px;
  box-shadow:
    0 1px 2px rgb(15 23 42 / 5%),
    0 8px 24px rgb(15 23 42 / 6%);
}

.document-placeholder,
.document-loading,
.document-error {
  display: grid;
  place-items: center;
  height: 100%;
  padding: 24px;
  text-align: center;
  font-size: 14px;
  line-height: 1.6;
}

.document-placeholder {
  color: #64748b;
}

.document-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgb(255 255 255 / 92%);
  color: #475569;
}

.document-error {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: #fff;
  color: #b91c1c;
}
</style>
