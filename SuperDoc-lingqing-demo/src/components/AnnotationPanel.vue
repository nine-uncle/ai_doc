<script setup lang="ts">
import type { Annotation } from '@/types/annotation'

defineProps<{
  annotation: Annotation
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <aside class="annotation-panel">
    <header class="panel-header">
      <h2>批注详情</h2>
      <button type="button" class="close-btn" aria-label="关闭批注" @click="emit('close')">
        ✕
      </button>
    </header>

    <div class="panel-body">
      <section class="section">
        <h3>引用内容</h3>
        <blockquote>{{ annotation.quote }}</blockquote>
      </section>

      <section class="section">
        <h3>批注说明</h3>
        <p>{{ annotation.content }}</p>
      </section>

      <div class="meta">
        <span>{{ annotation.author }}</span>
        <span>{{ annotation.createdAt }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.annotation-panel {
  display: flex;
  flex-direction: column;
  width: 300px;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  background: #fff;
  border-left: 1px solid #e5e7eb;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.panel-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.section + .section {
  margin-top: 20px;
}

.section h3 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

blockquote {
  margin: 0;
  padding: 10px 12px;
  border-left: 3px solid #447dfd;
  border-radius: 0 6px 6px 0;
  background: #f8fbff;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.6;
}

.section p {
  margin: 0;
  color: #374151;
  font-size: 13px;
  line-height: 1.7;
}

.meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
  color: #9ca3af;
  font-size: 12px;
}
</style>
