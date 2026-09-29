<script setup lang="ts">
import { ref } from 'vue'
import type { StreamPhase } from '@/types/document'

defineProps<{
  isStreaming: boolean
  streamPhase: StreamPhase
  statusMessage: string
  uploadedFileName: string
  hasUploadedDocument: boolean
}>()

const emit = defineEmits<{
  start: []
  upload: [file: File]
  export: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

const phaseLabel: Record<StreamPhase, string> = {
  idle: '待开始',
  toc: '构建目录',
  content: '加载文档',
  done: '已完成',
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('upload', file)
}
</script>

<template>
  <aside class="ai-panel">
    <header class="panel-header">
      <h2>AI 文档助手</h2>
    </header>

    <div class="panel-body">
      <p class="desc">
        上传客户样例 .docx 后，模拟 AI 处理流程：原生加载 Word 并完整还原格式，保留目录锚点跳转与正文双向联动编辑。
      </p>

      <input
        ref="fileInputRef"
        type="file"
        class="file-input"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        @change="handleFileChange"
      />

      <button
        type="button"
        class="upload-btn"
        :disabled="isStreaming"
        @click="openFilePicker"
      >
        上传 Word 文档
      </button>

      <p v-if="uploadedFileName" class="file-name" :title="uploadedFileName">
        已选择：{{ uploadedFileName }}
      </p>

      <button
        type="button"
        class="start-btn"
        :disabled="isStreaming || !hasUploadedDocument"
        @click="emit('start')"
      >
        {{ isStreaming ? '处理中…' : '模拟 AI 处理文档' }}
      </button>

      <button
        v-if="streamPhase === 'done'"
        type="button"
        class="export-btn"
        :disabled="isStreaming"
        @click="emit('export')"
      >
        导出 DOCX
      </button>

      <div class="status-card">
        <div class="status-row">
          <span class="label">当前阶段</span>
          <span class="value">{{ phaseLabel[streamPhase] }}</span>
        </div>
        <div class="status-row">
          <span class="label">状态</span>
          <span class="value message">{{ statusMessage }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #fff;
  border-left: 1px solid #e5e7eb;
}

.panel-header {
  padding: 14px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.panel-body {
  padding: 16px;
}

.desc {
  margin: 0 0 16px;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
}

.file-input {
  display: none;
}

.upload-btn,
.start-btn,
.export-btn {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.upload-btn {
  border: 1px dashed #93c5fd;
  background: #eff6ff;
  color: #1d4ed8;
}

.upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.start-btn {
  margin-top: 12px;
  border: 0;
  background: #2563eb;
  color: #fff;
}

.start-btn:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.export-btn {
  margin-top: 12px;
  border: 1px solid #93c5fd;
  background: #fff;
  color: #1d4ed8;
}

.export-btn:hover:not(:disabled) {
  background: #eff6ff;
}

.export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.file-name {
  margin: 10px 0 0;
  color: #374151;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}

.status-card {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.status-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.status-row + .status-row {
  margin-top: 10px;
}

.label {
  flex-shrink: 0;
  width: 64px;
  color: #6b7280;
}

.value {
  color: #111827;
}

.message {
  line-height: 1.5;
}
</style>
