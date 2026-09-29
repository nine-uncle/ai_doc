<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TocNode } from '@/types/document'

defineOptions({ name: 'DirectoryTreeNode' })

const props = defineProps<{
  node: TocNode
  activeNodeId: string | null
  editing: boolean
  depth?: number
}>()

const emit = defineEmits<{
  select: [id: string]
  'update-title': [id: string, title: string]
}>()

const expanded = ref(true)
const draftTitle = ref(props.node.title)
const depth = props.depth ?? 0

function toggle() {
  if (props.node.children.length > 0) {
    expanded.value = !expanded.value
  }
}

function handleSelect() {
  if (props.editing) return
  emit('select', props.node.id)
}

function commitTitle() {
  const nextTitle = draftTitle.value.trim()
  if (!nextTitle) {
    draftTitle.value = props.node.title
    return
  }
  if (nextTitle !== props.node.title) {
    emit('update-title', props.node.id, nextTitle)
  }
}

watch(
  () => props.node.title,
  (title) => {
    draftTitle.value = title
  },
)

watch(
  () => props.editing,
  (editing) => {
    if (editing) {
      draftTitle.value = props.node.title
    }
  },
)
</script>

<template>
  <li class="tree-node">
    <div
      class="tree-row"
      :class="{ active: !editing && activeNodeId === node.id, editing }"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
    >
      <button
        type="button"
        class="toggle"
        :class="{ invisible: node.children.length === 0 }"
        @click.stop="toggle"
      >
        {{ expanded ? '▾' : '▸' }}
      </button>

      <input
        v-if="editing"
        v-model="draftTitle"
        class="title-input"
        type="text"
        @blur="commitTitle"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
      <button v-else type="button" class="label" @click="handleSelect">
        {{ node.title }}
      </button>
    </div>

    <ul v-if="expanded && node.children.length > 0" class="tree-children">
      <DirectoryTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :active-node-id="activeNodeId"
        :editing="editing"
        :depth="depth + 1"
        @select="emit('select', $event)"
        @update-title="(id, title) => emit('update-title', id, title)"
      />
    </ul>
  </li>
</template>

<style scoped>
.tree-node {
  list-style: none;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 32px;
  border-radius: 4px;
}

.tree-row.active {
  background: #e8f0fe;
  box-shadow: inset 3px 0 0 #447dfd;
}

.tree-row.active .label {
  color: #2563eb;
  font-weight: 500;
}

.tree-row.editing {
  background: rgb(255 251 235 / 80%);
}

.toggle,
.label {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.toggle {
  width: 18px;
  color: #9ca3af;
  font-size: 11px;
}

.toggle.invisible {
  visibility: hidden;
}

.label {
  flex: 1;
  padding: 6px 8px 6px 4px;
  border-radius: 4px;
  text-align: left;
  color: #4b5563;
  font-size: 13px;
  line-height: 1.4;
}

.tree-row:not(.active) .label:hover {
  background: #f3f4f6;
  color: #111827;
}

.title-input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid #fcd34d;
  border-radius: 4px;
  background: #fff;
  color: #374151;
  font-size: 13px;
  line-height: 1.4;
}

.title-input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgb(245 158 11 / 15%);
}

.tree-children {
  margin: 0;
  padding: 0;
}
</style>
