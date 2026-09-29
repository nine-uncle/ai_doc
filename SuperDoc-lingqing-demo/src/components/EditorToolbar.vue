<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import type { BorrowedSuperDocUI } from 'superdoc/ui'
import type { SuperDocContentDoc } from '@/utils/superdocContent'
import type { SuperDocHeadingDoc } from '@/utils/headingSync'

const props = withDefaults(
  defineProps<{
    ui: BorrowedSuperDocUI | null
    getDocumentApi?: () => (SuperDocContentDoc & SuperDocHeadingDoc) | null
    disabled?: boolean
    canExport?: boolean
    exporting?: boolean
  }>(),
  {
    disabled: false,
    canExport: false,
    exporting: false,
  },
)

const emit = defineEmits<{
  'export-docx': []
}>()

let refreshKey = 0
let stopObservers: Array<() => void> = []

function bumpRefresh() {
  refreshKey += 1
}

function bindUi(ui: BorrowedSuperDocUI | null) {
  for (const stop of stopObservers) stop()
  stopObservers = []

  if (!ui) return

  const commandIds = [
    'undo',
    'redo',
    'bold',
    'italic',
    'underline',
    'strikethrough',
    'bullet-list',
    'numbered-list',
    'linked-style',
  ] as const

  for (const id of commandIds) {
    stopObservers.push(ui.commands.get(id).observe(bumpRefresh))
  }

  stopObservers.push(ui.styles.observe(bumpRefresh))
}

watch(
  () => props.ui,
  (ui) => {
    bindUi(ui)
    bumpRefresh()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  for (const stop of stopObservers) stop()
  stopObservers = []
})

const toolbarState = computed(() => {
  void refreshKey
  const ui = props.ui

  if (!ui) {
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

  const undo = ui.commands.get('undo').getState()
  const redo = ui.commands.get('redo').getState()
  const bold = ui.commands.get('bold').getState()
  const italic = ui.commands.get('italic').getState()
  const underline = ui.commands.get('underline').getState()
  const strike = ui.commands.get('strikethrough').getState()
  const bulletList = ui.commands.get('bullet-list').getState()
  const numberedList = ui.commands.get('numbered-list').getState()
  const linkedStyle = ui.commands.get('linked-style').getState()
  const activeStyleId = typeof linkedStyle.value === 'string' ? linkedStyle.value : null
  const styles = ui.styles.getSnapshot()

  const styleById = new Map(styles.quickGallery.map((style) => [style.id, style.name]))
  const activeStyleName = activeStyleId ? styleById.get(activeStyleId) ?? activeStyleId : ''

  let blockType = 'paragraph'
  if (/heading\s*1|标题\s*1/i.test(activeStyleName)) blockType = 'h1'
  else if (/heading\s*2|标题\s*2/i.test(activeStyleName)) blockType = 'h2'
  else if (/heading\s*3|标题\s*3/i.test(activeStyleName)) blockType = 'h3'

  return {
    canUndo: undo.enabled,
    canRedo: redo.enabled,
    isBold: bold.active,
    isItalic: italic.active,
    isUnderline: underline.active,
    isStrike: strike.active,
    isBulletList: bulletList.active,
    isOrderedList: numberedList.active,
    isBlockquote: false,
    isCode: false,
    blockType,
  }
})

const blockOptions = [
  { value: 'paragraph', label: '正文' },
  { value: 'h1', label: '标题 1' },
  { value: 'h2', label: '标题 2' },
  { value: 'h3', label: '标题 3' },
]

function runCommand(callback: (ui: BorrowedSuperDocUI) => void) {
  if (props.disabled || !props.ui) return
  callback(props.ui)
}

function resolveStyleId(ui: BorrowedSuperDocUI, blockType: string): string | null {
  const gallery = ui.styles.getSnapshot().quickGallery
  if (blockType === 'paragraph') {
    return (
      gallery.find((style) => /normal|正文|body/i.test(style.name))?.id ??
      gallery.find((style) => style.id === 'Normal')?.id ??
      gallery[0]?.id ??
      null
    )
  }

  const level = blockType.replace('h', '')
  return (
    gallery.find((style) => new RegExp(`heading\\s*${level}|标题\\s*${level}`, 'i').test(style.name))
      ?.id ??
    gallery.find((style) => style.id === `Heading${level}`)?.id ??
    null
  )
}

function setBlockType(value: string) {
  runCommand((ui) => {
    const styleId = resolveStyleId(ui, value)
    if (!styleId) return
    void ui.commands.get('linked-style').executeAsync(styleId)
  })
}

async function wrapSelectionHtml(tag: 'blockquote' | 'code') {
  if (props.disabled || !props.ui) return

  const capture = props.ui.selection.capture()
  const doc = props.getDocumentApi?.()
  const replace = doc?.replace
  if (!capture?.selectionTarget || !replace) return

  const text = capture.quotedText
  if (!text) return

  const value =
    tag === 'blockquote' ? `<blockquote><p>${text}</p></blockquote>` : `<code>${text}</code>`

  await Promise.resolve(
    replace({
      target: capture.selectionTarget,
      type: 'html',
      value,
    }),
  )
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
        @click="runCommand((ui) => void ui.commands.get('undo').executeAsync())"
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
        @click="runCommand((ui) => void ui.commands.get('redo').executeAsync())"
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
        @click="runCommand((ui) => void ui.commands.get('bold').executeAsync())"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: toolbarState.isItalic }"
        title="斜体"
        :disabled="disabled"
        @click="runCommand((ui) => void ui.commands.get('italic').executeAsync())"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: toolbarState.isUnderline }"
        title="下划线"
        :disabled="disabled"
        @click="runCommand((ui) => void ui.commands.get('underline').executeAsync())"
      >
        <span class="underline">U</span>
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: toolbarState.isStrike }"
        title="删除线"
        :disabled="disabled"
        @click="runCommand((ui) => void ui.commands.get('strikethrough').executeAsync())"
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
        @click="runCommand((ui) => void ui.commands.get('bullet-list').executeAsync())"
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
        @click="runCommand((ui) => void ui.commands.get('numbered-list').executeAsync())"
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
        @click="void wrapSelectionHtml('blockquote')"
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
        @click="void wrapSelectionHtml('code')"
      >
        &lt;/&gt;
      </button>
    </div>

    <div class="toolbar-group toolbar-group-end">
      <span class="toolbar-divider" />
      <button
        type="button"
        class="toolbar-btn export-btn"
        title="导出为 Word 文档（保留原始格式）"
        :disabled="!canExport || exporting"
        @click="emit('export-docx')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3v10m0 0 4-4m-4 4-4-4M5 19h14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>{{ exporting ? '导出中…' : '导出 DOCX' }}</span>
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

.toolbar-group-end {
  margin-left: auto;
}

.export-btn {
  gap: 6px;
  padding-inline: 10px;
  color: #1d4ed8;
}

.export-btn:hover:not(:disabled) {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.export-btn svg {
  width: 16px;
  height: 16px;
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
