<script setup lang="ts">
import { computed } from 'vue'
import AiAssistantPanel from '@/components/AiAssistantPanel.vue'
import DocumentWorkspace from '@/components/DocumentWorkspace.vue'
import { useDocumentStream } from '@/composables/useDocumentStream'

const {
  tocTree,
  isStreaming,
  streamPhase,
  statusMessage,
  activeNodeId,
  activeAnnotationId,
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
} = useDocumentStream()

const editorEditable = computed(() => streamPhase.value === 'done' || Boolean(documentLoadToken.value))
const hasUploadedDocument = computed(() => Boolean(uploadedFile.value))
</script>

<template>
  <div class="workspace">
    <DocumentWorkspace
      class="document-main"
      :toc-tree="tocTree"
      :active-node-id="activeNodeId"
      :active-annotation-id="activeAnnotationId"
      :editable="editorEditable"
      :is-streaming="isStreaming"
      :is-toc-streaming="isStreaming && streamPhase === 'toc'"
      :uploaded-docx-file="uploadedFile"
      :document-load-token="documentLoadToken"
      @select-toc="selectTocNode"
      @update-toc-title="updateTocNodeTitle"
      @select-annotation="selectAnnotation"
      @close-annotation="closeAnnotation"
      @editor-ready="onEditorReady"
      @document-process-failed="onDocumentProcessFailed"
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
