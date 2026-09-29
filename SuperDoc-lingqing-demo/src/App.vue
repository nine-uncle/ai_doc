<script setup lang="ts">
import { computed, ref } from 'vue'
import AiAssistantPanel from '@/components/AiAssistantPanel.vue'
import DocumentWorkspace from '@/components/DocumentWorkspace.vue'
import { useDocumentStream } from '@/composables/useDocumentStream'

const workspaceRef = ref<InstanceType<typeof DocumentWorkspace> | null>(null)

const {
  tocTree,
  htmlContent,
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
  onDocumentProcessed,
  onDocumentProcessFailed,
  selectTocNode,
  selectAnnotation,
  closeAnnotation,
  updateTocNodeTitle,
  clearHeadingSyncFromToc,
  syncTocFromDocumentHeadings,
  runAiDocumentAction,
  headingSyncFromToc,
  onExportDocxSuccess,
  onExportDocxFailed,
} = useDocumentStream()

const editorEditable = computed(() => streamPhase.value === 'done')
const hasUploadedDocument = computed(() => Boolean(uploadedFile.value))

function exportDocument() {
  void workspaceRef.value?.exportDocx()
}
</script>

<template>
  <div class="workspace">
    <DocumentWorkspace
      ref="workspaceRef"
      class="document-main"
      :toc-tree="tocTree"
      :content="htmlContent"
      :heading-sync-from-toc="headingSyncFromToc"
      :active-node-id="activeNodeId"
      :active-annotation-id="activeAnnotationId"
      :editable="editorEditable"
      :is-streaming="isStreaming"
      :is-toc-streaming="isStreaming && streamPhase === 'toc'"
      :loading-action="aiActionLoading"
      :uploaded-docx-file="uploadedFile"
      :document-load-token="documentLoadToken"
      @select-toc="selectTocNode"
      @update-toc-title="updateTocNodeTitle"
      @select-annotation="selectAnnotation"
      @close-annotation="closeAnnotation"
      @ai-action="runAiDocumentAction"
      @heading-titles-change="syncTocFromDocumentHeadings"
      @heading-sync-applied="clearHeadingSyncFromToc"
      @document-processed="onDocumentProcessed"
      @document-process-failed="onDocumentProcessFailed"
      @export-docx-success="onExportDocxSuccess"
      @export-docx-failed="onExportDocxFailed"
    />

    <AiAssistantPanel
      class="panel-right"
      :is-streaming="isStreaming"
      :stream-phase="streamPhase"
      :status-message="statusMessage"
      :uploaded-file-name="uploadedFileName"
      :has-uploaded-document="hasUploadedDocument"
      @upload="uploadDocument"
      @start="startMockStream"
      @export="exportDocument"
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
