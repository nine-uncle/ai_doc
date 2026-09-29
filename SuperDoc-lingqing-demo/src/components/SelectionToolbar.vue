<script setup lang="ts">
import {
  AI_ACTION_LABELS,
  AI_SELECTION_ACTIONS,
  type AiDocumentAction,
} from '@/types/aiAction'

defineProps<{
  loadingAction: AiDocumentAction | null
}>()

const emit = defineEmits<{
  action: [action: AiDocumentAction]
}>()
</script>

<template>
  <div class="selection-toolbar" role="toolbar" aria-label="选区 AI 功能">
    <button
      v-for="action in AI_SELECTION_ACTIONS"
      :key="action"
      type="button"
      class="toolbar-btn"
      :disabled="Boolean(loadingAction)"
      @mousedown.prevent
      @click="emit('action', action)"
    >
      <span v-if="loadingAction === action" class="loading-dot" />
      {{ AI_ACTION_LABELS[action] }}
    </button>
  </div>
</template>

<style scoped>
.selection-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  box-shadow:
    0 10px 24px rgb(15 23 42 / 12%),
    0 2px 6px rgb(15 23 42 / 6%);
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #1f2937;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}

.toolbar-btn:hover:not(:disabled) {
  background: #f3f4f6;
  color: #2563eb;
}

.toolbar-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
  animation: pulse 0.8s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 1;
  }
}
</style>
