<script setup lang="ts">
import { computed } from 'vue'
import AnnotationPanel from '@/components/AnnotationPanel.vue'
import DocumentEditor from '@/components/DocumentEditor.vue'
import { getAnnotation } from '@/mock/mockAnnotations'
import type { AiDocumentAction } from '@/types/aiAction'
import type { JSONContent } from '@tiptap/core'
import type { TocNode } from '@/types/document'

const props = defineProps<{
  tocTree: TocNode[]
  content: JSONContent | null
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
  'close-annotation': []
  'ai-action': [action: AiDocumentAction, text: string, from: number, to: number]
  'heading-titles-change': [titles: Record<string, string>]
  'heading-sync-applied': []
}>()

const activeAnnotation = computed(() => {
  if (!props.activeAnnotationId) return null
  return getAnnotation(props.activeAnnotationId)
})

const hasAnnotationPanel = computed(() => Boolean(activeAnnotation.value))
</script>

<template>
  <div class="document-workspace" :class="{ 'has-annotation': hasAnnotationPanel }">
    <DocumentEditor
      class="editor-panel"
      :content="content"
      :toc-tree="tocTree"
      :heading-sync-from-toc="headingSyncFromToc"
      :active-node-id="activeNodeId"
      :active-annotation-id="activeAnnotationId"
      :editable="editable"
      :is-streaming="isStreaming"
      :is-toc-streaming="isTocStreaming"
      :loading-action="loadingAction"
      :observe-format="observeFormat"
      @select-toc="emit('select-toc', $event)"
      @update-toc-title="(id, title) => emit('update-toc-title', id, title)"
      @select-annotation="emit('select-annotation', $event)"
      @ai-action="(action, text, from, to) => emit('ai-action', action, text, from, to)"
      @heading-titles-change="emit('heading-titles-change', $event)"
      @heading-sync-applied="emit('heading-sync-applied')"
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
