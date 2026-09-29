<script setup lang="ts">
import { ref } from 'vue'
import type { DocxImportReport, StreamPhase } from '@/types/document'

defineProps<{
  isStreaming: boolean
  isUploading: boolean
  streamPhase: StreamPhase
  statusMessage: string
  uploadedFileName: string | null
  importReport: DocxImportReport | null
}>()

const emit = defineEmits<{
  start: []
  upload: [file: File]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

const phaseLabel: Record<StreamPhase, string> = {
  idle: '待开始',
  toc: '生成目录',
  content: '生成正文',
  done: '已完成',
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  emit('upload', file)
  input.value = ''
}
</script>

<template>
  <aside class="ai-panel">
    <header class="panel-header">
      <h2>AI 文档助手</h2>
    </header>

    <div class="panel-body">
      <p class="desc">
        上传客户样例 .docx，模拟 AI 基于该文档流式输出目录与正文，用于观察 Word → 编辑器的格式与结构差异。
      </p>

      <input
        ref="fileInputRef"
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        class="file-input"
        @change="handleFileChange"
      />

      <button
        type="button"
        class="upload-btn"
        :disabled="isUploading || isStreaming"
        @click="openFilePicker"
      >
        {{ isUploading ? '解析中…' : '上传 Word 文档' }}
      </button>

      <div v-if="uploadedFileName" class="file-card">
        <div class="file-name">{{ uploadedFileName }}</div>
        <p class="file-hint">已解析，可开始模拟 AI 处理</p>
      </div>

      <div v-if="importReport" class="report-card">
        <div class="report-title">解析摘要</div>
        <div class="report-grid">
          <span>标题 {{ importReport.headingCount }}</span>
          <span>段落 {{ importReport.paragraphCount }}</span>
          <span>表格 {{ importReport.tableCount }}</span>
          <span>图片 {{ importReport.imageCount }}</span>
          <span>列表 {{ importReport.listCount }}</span>
          <span>带样式文本 {{ importReport.styledTextCount }}</span>
        </div>
      </div>

      <button
        type="button"
        class="start-btn"
        :disabled="isStreaming || isUploading || !uploadedFileName"
        @click="emit('start')"
      >
        {{ isStreaming ? '处理中…' : '模拟 AI 处理文档' }}
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
  overflow-y: auto;
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
.start-btn {
  width: 100%;
  padding: 10px 14px;
  border: 0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.upload-btn {
  background: #f3f4f6;
  color: #111827;
  border: 1px solid #d1d5db;
}

.upload-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.start-btn {
  margin-top: 12px;
  background: #2563eb;
  color: #fff;
}

.start-btn:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.file-card,
.report-card,
.status-card {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.file-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  word-break: break-all;
}

.file-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.report-title {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.report-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
  font-size: 12px;
  color: #4b5563;
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
