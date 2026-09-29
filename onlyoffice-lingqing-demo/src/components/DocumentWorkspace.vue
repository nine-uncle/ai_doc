<script setup lang="ts">
import { computed, ref } from 'vue'
import AnnotationPanel from '@/components/AnnotationPanel.vue'
import DocumentEditor from '@/components/DocumentEditor.vue'
import { getAnnotation } from '@/mock/mockAnnotations'
import type { TocNode } from '@/types/document'

const props = defineProps<{
  tocTree: TocNode[]
  activeNodeId: string | null
  activeAnnotationId: string | null
  editable: boolean
  isStreaming: boolean
  isTocStreaming: boolean
  uploadedDocxFile: File | null
  documentLoadToken: number
}>()

const emit = defineEmits<{
  'select-toc': [id: string]
  'update-toc-title': [id: string, title: string]
  'select-annotation': [id: string]
  'close-annotation': []
  'editor-ready': []
  'document-process-failed': [message: string]
}>()

const editorRef = ref<InstanceType<typeof DocumentEditor> | null>(null)

const activeAnnotation = computed(() => {
  if (!props.activeAnnotationId) return null
  return getAnnotation(props.activeAnnotationId)
})

const hasAnnotationPanel = computed(() => Boolean(activeAnnotation.value))
</script>

<template>
  <div class="document-workspace" :class="{ 'has-annotation': hasAnnotationPanel }">
    <DocumentEditor
      ref="editorRef"
      class="editor-panel"
      :toc-tree="tocTree"
      :active-node-id="activeNodeId"
      :editable="editable"
      :is-toc-streaming="isTocStreaming"
      :uploaded-docx-file="uploadedDocxFile"
      :document-load-token="documentLoadToken"
      @select-toc="emit('select-toc', $event)"
      @update-toc-title="(id, title) => emit('update-toc-title', id, title)"
      @select-annotation="emit('select-annotation', $event)"
      @editor-ready="emit('editor-ready')"
      @document-process-failed="emit('document-process-failed', $event)"
    />

    <AnnotationPanel
      v-if="activeAnnotation"
      :annotation="activeAnnotation"
      @close="emit('close-annotation')"
    />
  </div>
</template>

<style scoped>
.document-workspace {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #f5f7f9;
}

.editor-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.document-workspace.has-annotation .editor-panel {
  flex: 1 1 0;
}
</style>
