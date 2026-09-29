<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import type { Editor } from '@tiptap/core'

const props = defineProps<{
  editor: Editor | undefined
  disabled?: boolean
}>()

let refreshKey = 0

function bumpRefresh() {
  refreshKey += 1
}

function bindEditor(currentEditor: Editor | undefined) {
  if (!currentEditor) return

  currentEditor.on('selectionUpdate', bumpRefresh)
  currentEditor.on('transaction', bumpRefresh)
}

function unbindEditor(currentEditor: Editor | undefined) {
  if (!currentEditor) return

  currentEditor.off('selectionUpdate', bumpRefresh)
  currentEditor.off('transaction', bumpRefresh)
}

watch(
  () => props.editor,
  (currentEditor, previousEditor) => {
    unbindEditor(previousEditor)
    bindEditor(currentEditor)
    bumpRefresh()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  unbindEditor(props.editor)
})

const toolbarState = computed(() => {
  void refreshKey
  const currentEditor = props.editor

  if (!currentEditor) {
    return {
      canUndo: false,
      canRedo: false,
      isBold: false,
      isItalic: false,
      isUnderline: false,
      isStrike: false,
      isBulletList: false,
      isOrderedList: false,
      isBlockquote: false,
      isCode: false,
      blockType: 'paragraph',
    }
  }

  return {
    canUndo: currentEditor.can().undo(),
    canRedo: currentEditor.can().redo(),
    isBold: currentEditor.isActive('bold'),
    isItalic: currentEditor.isActive('italic'),
    isUnderline: currentEditor.isActive('underline'),
    isStrike: currentEditor.isActive('strike'),
    isBulletList: currentEditor.isActive('bulletList'),
    isOrderedList: currentEditor.isActive('orderedList'),
    isBlockquote: currentEditor.isActive('blockquote'),
    isCode: currentEditor.isActive('code'),
    blockType: currentEditor.isActive('heading', { level: 1 })
      ? 'h1'
      : currentEditor.isActive('heading', { level: 2 })
        ? 'h2'
        : currentEditor.isActive('heading', { level: 3 })
          ? 'h3'
          : 'paragraph',
  }
})

const blockOptions = [
  { value: 'paragraph', label: '正文' },
  { value: 'h1', label: '标题 1' },
  { value: 'h2', label: '标题 2' },
  { value: 'h3', label: '标题 3' },
]

function runCommand(callback: (editor: Editor) => void) {
  if (props.disabled || !props.editor) return
  callback(props.editor)
}

function setBlockType(value: string) {
  runCommand((currentEditor) => {
    const chain = currentEditor.chain().focus()

    if (value === 'paragraph') {
      chain.setParagraph().run()
      return
    }

    const level = Number(value.replace('h', '')) as 1 | 2 | 3
    chain.setHeading({ level }).run()
  })
}
</script>

<template>
  <div class="editor-toolbar" :class="{ disabled }" role="toolbar" aria-label="编辑器工具栏">
    <div class="toolbar-group">
      <button
        type="button"
        class="toolbar-btn icon-btn"
        title="撤销"
        :disabled="disabled || !toolbarState.canUndo"
        @click="runCommand((editor) => editor.chain().focus().undo().run())"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 7H5v4h4V7Zm0 0-5 5m5-5 5 5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="toolbar-btn icon-btn"
        title="重做"
        :disabled="disabled || !toolbarState.canRedo"
        @click="runCommand((editor) => editor.chain().focus().redo().run())"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M15 7h4v4h-4V7Zm0 0 5 5m-5-5-5 5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <span class="toolbar-divider" />

    <div class="toolbar-group">
      <label class="block-select">
        <span class="sr-only">段落样式</span>
        <select
          :value="toolbarState.blockType"
          :disabled="disabled"
          @change="setBlockType(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in blockOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>

    <span class="toolbar-divider" />

    <div class="toolbar-group">
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: toolbarState.isBold }"
        title="加粗"
        :disabled="disabled"
        @click="runCommand((editor) => editor.chain().focus().toggleBold().run())"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: toolbarState.isItalic }"
        title="斜体"
        :disabled="disabled"
        @click="runCommand((editor) => editor.chain().focus().toggleItalic().run())"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: toolbarState.isUnderline }"
        title="下划线"
        :disabled="disabled"
        @click="runCommand((editor) => editor.chain().focus().toggleUnderline().run())"
      >
        <span class="underline">U</span>
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: toolbarState.isStrike }"
        title="删除线"
        :disabled="disabled"
        @click="runCommand((editor) => editor.chain().focus().toggleStrike().run())"
      >
        <span class="strike">S</span>
      </button>
    </div>

    <span class="toolbar-divider" />

    <div class="toolbar-group">
      <button
        type="button"
        class="toolbar-btn icon-btn"
        :class="{ active: toolbarState.isBulletList }"
        title="无序列表"
        :disabled="disabled"
        @click="runCommand((editor) => editor.chain().focus().toggleBulletList().run())"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="4" cy="6" r="1.2" fill="currentColor" />
          <circle cx="4" cy="12" r="1.2" fill="currentColor" />
          <circle cx="4" cy="18" r="1.2" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        class="toolbar-btn icon-btn"
        :class="{ active: toolbarState.isOrderedList }"
        title="有序列表"
        :disabled="disabled"
        @click="runCommand((editor) => editor.chain().focus().toggleOrderedList().run())"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path
            d="M4 5v3M4 11v3M4 17v3"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="toolbar-btn icon-btn"
        :class="{ active: toolbarState.isBlockquote }"
        title="引用"
        :disabled="disabled"
        @click="runCommand((editor) => editor.chain().focus().toggleBlockquote().run())"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 8c0-2 1.5-3 3.5-3 1.2 0 2 .4 2.6 1M6 16c0-2 1.5-3 3.5-3 1.2 0 2 .4 2.6 1"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: toolbarState.isCode }"
        title="行内代码"
        :disabled="disabled"
        @click="runCommand((editor) => editor.chain().focus().toggleCode().run())"
      >
        &lt;/&gt;
      </button>
    </div>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 16px;
  border-bottom: 1px solid #ebedf0;
  background: #fff;
}

.editor-toolbar.disabled {
  opacity: 0.72;
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 22px;
  margin: 0 4px;
  background: #d1d5db;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
}

.toolbar-btn:hover:not(:disabled) {
  border-color: #d1d5db;
  background: #fff;
}

.toolbar-btn.active {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
}

.toolbar-btn:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.icon-btn svg {
  width: 16px;
  height: 16px;
}

.underline {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.strike {
  text-decoration: line-through;
}

.block-select select {
  min-width: 96px;
  height: 32px;
  padding: 0 28px 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E")
    no-repeat right 10px center;
  color: #374151;
  font-size: 13px;
  appearance: none;
  cursor: pointer;
}

.block-select select:disabled {
  background-color: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.block-select select:focus {
  outline: none;
  border-color: #93c5fd;
  box-shadow: 0 0 0 2px rgb(147 197 253 / 35%);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
