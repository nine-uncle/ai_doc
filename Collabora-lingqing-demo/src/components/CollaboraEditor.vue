<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CollaboraExportFormat, CollaboraMessage, WopiLaunchInfo } from '@/types/collabora'
import { SELECTION_AI_TOOLS, selectionAiIconUrl } from '@/constants/selectionAiTools'

const props = defineProps<{ session: WopiLaunchInfo; collaboraUrl: string }>()
const emit = defineEmits<{
  ready: []
  status: [message: string]
  saved: []
  error: [message: string]
  modified: [modified: boolean]
  exportFormats: [formats: CollaboraExportFormat[]]
  contextualAction: [id: string]
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const launchFormRef = ref<HTMLFormElement | null>(null)
const documentReady = ref(false)
const frameName = `collabora-frame-${Math.random().toString(36).slice(2)}`
const pendingTextSelection: Array<(text: string) => void> = []
let navigatorOpenTimer = 0

const normalizedCollaboraUrl = computed(() => props.collaboraUrl.replace(/\/$/, ''))
const collaboraOrigin = computed(() => new URL(normalizedCollaboraUrl.value).origin)
const editorUrl = computed(
  () =>
    `${normalizedCollaboraUrl.value}/browser/dist/cool.html` +
    `?WOPISrc=${encodeURIComponent(props.session.wopiSrc)}` +
    '&lang=zh-CN&closebutton=0',
)

function parseMessage(data: unknown): CollaboraMessage | null {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as CollaboraMessage
    } catch {
      return null
    }
  }
  return data && typeof data === 'object' ? (data as CollaboraMessage) : null
}

function postMessage(messageId: string, values: Record<string, unknown> = {}): boolean {
  const target = iframeRef.value?.contentWindow
  if (!target) return false
  target.postMessage(
    JSON.stringify({ MessageId: messageId, SendTime: Date.now(), Values: values }),
    collaboraOrigin.value,
  )
  return true
}

function hideEmbeddedUiChrome(): boolean {
  const menubarHidden = postMessage('Hide_Menubar')
  const sidebarHidden = postMessage('Hide_Sidebar')
  return menubarHidden && sidebarHidden
}

function showNavigator(): boolean {
  return postMessage('Send_UNO_Command', {
    Command: '.uno:Navigator',
  })
}

function openNavigatorByDefault() {
  window.clearTimeout(navigatorOpenTimer)
  navigatorOpenTimer = window.setTimeout(() => {
    showNavigator()
  }, 350)
}

function insertSelectionAiButtons() {
  const iconOrigin = window.location.origin
  for (const tool of SELECTION_AI_TOOLS) {
    postMessage('Insert_ContextualButton', {
      id: tool.id,
      imgurl: selectionAiIconUrl(iconOrigin, tool.id),
      hint: tool.label,
      type: 'toolitem',
    })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseExportFormats(values: unknown): CollaboraExportFormat[] {
  let candidates: unknown[] = []

  if (Array.isArray(values)) {
    candidates = values
  } else if (isRecord(values)) {
    const nestedFormats = values.Formats ?? values.formats
    candidates = Array.isArray(nestedFormats) ? nestedFormats : [values]
  }

  const uniqueFormats = new Map<string, CollaboraExportFormat>()
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue

    const rawFormat = candidate.Format ?? candidate.format
    const rawLabel = candidate.Label ?? candidate.label
    if (typeof rawFormat !== 'string' || !rawFormat.trim()) continue

    const format = rawFormat.trim().replace(/^\./, '').toLowerCase()
    const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : format.toUpperCase()
    uniqueFormats.set(format, { label, format })
  }

  return [...uniqueFormats.values()]
}

function parseTextSelection(values: unknown): string {
  if (typeof values === 'string') {
    const trimmed = values.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (parsed && typeof parsed === 'object') return parseTextSelection(parsed)
      } catch {
        return values
      }
    }
    return values
  }
  if (typeof values === 'number' || typeof values === 'boolean') return String(values)
  if (!isRecord(values)) return ''

  const named =
    values.content ??
    values.Content ??
    values.text ??
    values.Text ??
    values.selection ??
    values.Selection ??
    values.data ??
    values.Data
  if (typeof named === 'string') return parseTextSelection(named)

  const plain = values['text/plain;charset=utf-8'] ?? values['text/plain']
  if (typeof plain === 'string') return plain

  const html = values['text/html;charset=utf-8'] ?? values['text/html']
  return typeof html === 'string' ? html : ''
}

function resolveTextSelection(text: string) {
  const resolve = pendingTextSelection.shift()
  resolve?.(text)
}

function handleCollaboraMessage(event: MessageEvent) {
  if (event.source !== iframeRef.value?.contentWindow || event.origin !== collaboraOrigin.value) return

  const message = parseMessage(event.data)
  if (!message?.MessageId) return
  const values = isRecord(message.Values) ? message.Values : {}

  if (message.MessageId === 'App_LoadingStatus') {
    const status = String(values.Status || '')
    if (status === 'Initialized' || status === 'Frame_Ready') {
      postMessage('Host_PostmessageReady')
      emit('status', status === 'Frame_Ready' ? 'Collabora 界面已就绪，正在加载文档…' : '正在初始化编辑器…')
    } else if (status === 'Document_Loaded') {
      documentReady.value = true
      hideEmbeddedUiChrome()
      insertSelectionAiButtons()
      getExportFormats()
      openNavigatorByDefault()
      emit('ready')
    } else if (status === 'Failed') {
      emit('error', 'Collabora 无法加载此文档，请检查 CODE 与 WOPI 地址配置')
    }
    return
  }

  if (message.MessageId === 'Action_Save_Resp') {
    const success = values.success ?? values.Success
    if (success === false) emit('error', 'Collabora 返回保存失败')
    else emit('saved')
    return
  }

  if (message.MessageId === 'Doc_ModifiedStatus') {
    emit('modified', Boolean(values.Modified ?? values.modified))
    return
  }

  if (message.MessageId === 'Get_Export_Formats_Resp') {
    const formats = parseExportFormats(message.Values)
    if (formats.length) emit('exportFormats', formats)
    else emit('error', 'Collabora 未返回可用的导出格式')
    return
  }

  if (message.MessageId === 'Get_TextSelection_Resp' || message.MessageId === 'Action_Copy_Resp') {
    resolveTextSelection(parseTextSelection(message.Values))
    return
  }

  if (message.MessageId === 'Clicked_ContextualButton' || message.MessageId === 'Clicked_Button') {
    const buttonId = String(values.Id ?? values.id ?? '')
    if (buttonId) emit('contextualAction', buttonId)
  }
}

function insertText(text: string): boolean {
  if (!documentReady.value || !text) return false
  return postMessage('Send_UNO_Command', {
    Command: '.uno:InsertText',
    Args: { Text: { type: 'string', value: text } },
  })
}

function pasteHtml(html: string): boolean {
  if (!documentReady.value || !html) return false
  postMessage('Grab_Focus')
  return postMessage('Action_Paste', {
    Mimetype: 'text/html;charset=utf-8',
    Data: html,
  })
}

function replaceSelection(text: string): boolean {
  if (!documentReady.value || !text) return false
  postMessage('Grab_Focus')
  return postMessage('Action_Paste', {
    Mimetype: 'text/plain;charset=utf-8',
    Data: text,
  })
}

function getTextSelection(): Promise<string> {
  if (!documentReady.value) return Promise.resolve('')

  return new Promise((resolve) => {
    pendingTextSelection.push(resolve)
    // CODE 26.04 没有 Get_TextSelection，读取选区要用 Action_Copy。
    const sent = postMessage('Action_Copy', {
      Mimetype: 'text/plain;charset=utf-8',
    })
    if (!sent) {
      const index = pendingTextSelection.indexOf(resolve)
      if (index >= 0) pendingTextSelection.splice(index, 1)
      resolve('')
      return
    }
    window.setTimeout(() => {
      const index = pendingTextSelection.indexOf(resolve)
      if (index < 0) return
      pendingTextSelection.splice(index, 1)
      resolve('')
    }, 2000)
  })
}

function save(): boolean {
  if (!documentReady.value) return false
  return postMessage('Action_Save', {
    Notify: true,
    DontTerminateEdit: true,
    DontSaveIfUnmodified: false,
  })
}

function getExportFormats(): boolean {
  if (!documentReady.value) return false
  return postMessage('Get_Export_Formats')
}

function exportAs(format: string): boolean {
  const normalizedFormat = format.trim().replace(/^\./, '').toLowerCase()
  if (!documentReady.value || !normalizedFormat) return false
  return postMessage('Action_Export', {
    Format: normalizedFormat,
    Notify: true,
  })
}

defineExpose({
  insertText,
  pasteHtml,
  replaceSelection,
  getTextSelection,
  save,
  getExportFormats,
  exportAs,
  hideEmbeddedUiChrome,
})

onMounted(() => {
  window.addEventListener('message', handleCollaboraMessage)
  void nextTick(() => launchFormRef.value?.submit())
})

onBeforeUnmount(() => {
  window.clearTimeout(navigatorOpenTimer)
  window.removeEventListener('message', handleCollaboraMessage)
})
</script>

<template>
  <div class="collabora-editor">
    <form ref="launchFormRef" class="launch-form" method="post" :action="editorUrl" :target="frameName">
      <input type="hidden" name="access_token" :value="session.accessToken" />
    </form>
    <iframe
      ref="iframeRef"
      :name="frameName"
      class="collabora-frame"
      title="Collabora Online 文档编辑器"
      allow="clipboard-read; clipboard-write"
    />
    <div v-if="!documentReady" class="loading-layer">
      <span class="spinner" />
      <span>正在连接 Collabora Online…</span>
    </div>
  </div>
</template>

<style scoped>
.collabora-editor { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; background: #e8edf3; }
.launch-form { display: none; }
.collabora-frame { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
.loading-layer { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748b; font-size: 14px; background: #f3f6f9; }
.spinner { width: 20px; height: 20px; border: 2px solid #cbd5e1; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
