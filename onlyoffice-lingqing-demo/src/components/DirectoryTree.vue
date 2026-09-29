<script setup lang="ts">
import { ref } from 'vue'
import DirectoryTreeNode from './DirectoryTreeNode.vue'
import type { TocNode } from '@/types/document'

defineProps<{
  nodes: TocNode[]
  activeNodeId: string | null
  isStreaming: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  'update-title': [id: string, title: string]
}>()

const isEditing = ref(false)

function toggleEditing() {
  if (isEditing.value) {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }
  isEditing.value = !isEditing.value
}
</script>

<template>
  <aside class="directory-tree">
    <header class="panel-header">
      <h2>目录</h2>
      <div class="header-actions">
        <span v-if="isStreaming" class="badge">生成中</span>
        <button
          type="button"
          class="edit-btn"
          :class="{ active: isEditing }"
          :disabled="nodes.length === 0"
          @click="toggleEditing"
        >
          {{ isEditing ? '完成' : '调整目录' }}
        </button>
      </div>
    </header>

    <div v-if="nodes.length === 0" class="empty">
      暂无目录，等待 AI 返回…
    </div>

    <ul v-else class="tree-root">
      <DirectoryTreeNode
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :active-node-id="activeNodeId"
        :editing="isEditing"
        @select="emit('select', $event)"
        @update-title="(id, title) => emit('update-title', id, title)"
      />
    </ul>
  </aside>
</template>

<style scoped>
.directory-tree {
  display: flex;
  flex-direction: column;
  width: 280px;
  height: 100%;
  min-height: 0;
  background: #fff;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px 10px;
}

.panel-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
}

.edit-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
}

.edit-btn:hover:not(:disabled) {
  color: #2563eb;
}

.edit-btn.active {
  color: #2563eb;
  font-weight: 500;
}

.edit-btn:disabled {
  color: #c4c9d2;
  cursor: not-allowed;
}

.empty {
  padding: 20px 16px;
  color: #9ca3af;
  font-size: 13px;
  line-height: 1.6;
}

.tree-root {
  margin: 0;
  padding: 4px 8px 16px;
  list-style: none;
  overflow: auto;
  flex: 1;
  min-height: 0;
}
</style>
