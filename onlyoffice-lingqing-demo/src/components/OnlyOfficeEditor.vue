<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DocumentEditor } from '@onlyoffice/document-editor-vue'
import type { OnlyOfficeConfig } from '@/types/onlyoffice'

const props = defineProps<{
  config: OnlyOfficeConfig | null
}>()

const emit = defineEmits<{
  ready: []
  error: [message: string]
}>()

const EDITOR_ID = 'onlyoffice-editor-container'
const initError = ref('')

const documentServerUrl = computed(
  () => props.config?._meta?.onlyofficeServerUrl?.replace(/\/$/, '') || '',
)

function handleDocumentReady() {
  initError.value = ''
  emit('ready')
}

function handleLoadComponentError(
  _errorCode: number,
  errorDescription: string | undefined,
) {
  let message = errorDescription || 'ONLYOFFICE 初始化失败'

  if (errorDescription?.includes('Download failed') || errorDescription?.includes('Error')) {
    message = `无法加载 ONLYOFFICE API：${documentServerUrl.value}/web-apps/apps/api/documents/api.js。请确认 Document Server 已启动（pnpm onlyoffice:up）。`
  }

  initError.value = message
  emit('error', message)
}

function handleError(event: { data?: { errorDescription?: string } }) {
  const message = event?.data?.errorDescription || 'ONLYOFFICE 编辑器发生错误'
  initError.value = message
  emit('error', message)
}

watch(
  () => props.config?.document.key,
  () => {
    initError.value = ''
  },
)
</script>

<template>
  <div class="onlyoffice-editor">
    <div v-if="initError" class="onlyoffice-editor__error">
      <p>{{ initError }}</p>
      <p class="hint">Document Server 地址：{{ documentServerUrl || '未配置' }}</p>
    </div>

    <DocumentEditor
      v-if="config && documentServerUrl && !initError"
      :id="EDITOR_ID"
      :document-server-url="documentServerUrl"
      :config="config"
      :events_on-document-ready="handleDocumentReady"
      :events_on-error="handleError"
      :on-load-component-error="handleLoadComponentError"
    />
  </div>
</template>

<style scoped>
.onlyoffice-editor {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.onlyoffice-editor__error {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  background: #fff;
  color: #b91c1c;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
</style>
