<script setup lang="ts">
import { computed } from 'vue'
import AiAssistantPanel from '@/components/AiAssistantPanel.vue'
import DocumentWorkspace from '@/components/DocumentWorkspace.vue'
import { useDocumentStream } from '@/composables/useDocumentStream'

const {
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
  uploadDocx,
  startMockStream,
  selectTocNode,
  selectAnnotation,
  closeAnnotation,
  updateTocNodeTitle,
  clearHeadingSyncFromToc,
  syncTocFromDocumentHeadings,
  runAiDocumentAction,
  headingSyncFromToc,
} = useDocumentStream()

const editorEditable = computed(() => streamPhase.value === 'done')
</script>

<template>
  <div class="workspace">
    <DocumentWorkspace
      class="document-main"
      :toc-tree="tocTree"
      :content="editorContent"
      :heading-sync-from-toc="headingSyncFromToc"
      :active-node-id="activeNodeId"
      :active-annotation-id="activeAnnotationId"
      :editable="editorEditable"
      :is-streaming="isStreaming"
      :is-toc-streaming="isStreaming && streamPhase === 'toc'"
      :loading-action="aiActionLoading"
      :observe-format="Boolean(uploadedFileName)"
      @select-toc="selectTocNode"
      @update-toc-title="updateTocNodeTitle"
      @select-annotation="selectAnnotation"
      @close-annotation="closeAnnotation"
      @ai-action="runAiDocumentAction"
      @heading-titles-change="syncTocFromDocumentHeadings"
      @heading-sync-applied="clearHeadingSyncFromToc"
    />

    <AiAssistantPanel
      class="panel-right"
      :is-streaming="isStreaming"
      :is-uploading="isUploading"
      :stream-phase="streamPhase"
      :status-message="statusMessage"
      :uploaded-file-name="uploadedFileName"
      :import-report="importReport"
      @start="startMockStream"
      @upload="uploadDocx"
    />
  </div>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  height: 100%;
  background: #eef1f5;
}

.document-main {
  min-width: 0;
  min-height: 0;
}

.panel-right {
  min-width: 0;
  min-height: 0;
}
</style>
