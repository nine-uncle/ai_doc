<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { SendOutlined } from '@nancal-icon/icons-vue'
import { CHATBOX_SOURCE, HOST_SOURCE, type ChatboxDocumentContext, type ChatboxTool } from '@/constants/chatboxBridge'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
}

const messages = ref<ChatMessage[]>([
  {
    id: 1,
    role: 'assistant',
    text: '你好，我是文档助手。可以直接对话，例如「生成目录」「把分析写入文档」「流式写入一段说明」。需要改文档时，我会通知编辑器锁定，避免和你同时改。',
  },
])
const draft = ref('')
const sending = ref(false)
const documentContext = ref<ChatboxDocumentContext | null>(null)
const editorReady = ref(false)
const hostProcessing = ref(false)
const listRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
let messageSeq = 1

// const quickActions = [
//   { label: '写入分析', tool: 'write-analysis' as const },
//   { label: '生成目录', tool: 'generate-toc' as const },
//   { label: '流式写入', tool: 'stream' as const },
// ]

const hint = computed(() => {
  if (!documentContext.value) return '等待文档上下文…'
  if (!editorReady.value) return `已连接「${documentContext.value.name}」，编辑器准备中`
  if (hostProcessing.value) return 'AI 正在写入文档，请稍候'
  return `当前文档：${documentContext.value.name}`
})

function postToHost(payload: { type: 'ready' } | { type: 'run-tool'; tool: ChatboxTool }) {
  window.parent.postMessage({ source: CHATBOX_SOURCE, ...payload }, window.location.origin)
}

function scrollToBottom() {
  void nextTick(() => {
    const list = listRef.value
    if (list) list.scrollTop = list.scrollHeight
  })
}

function detectTool(text: string): ChatboxTool | null {
  if (/流式/.test(text)) return 'stream'
  if (/目录/.test(text)) return 'generate-toc'
  if (/分析|写入正文|写进文档|写入文档/.test(text)) return 'write-analysis'
  if (/改写/.test(text)) return 'aidoc-rewrite'
  if (/扩写/.test(text)) return 'aidoc-expand'
  if (/缩写/.test(text)) return 'aidoc-condense'
  if (/润色/.test(text)) return 'aidoc-polish'
  if (/摘要/.test(text)) return 'aidoc-summary'
  if (/术语/.test(text)) return 'aidoc-terms'
  if (/配图/.test(text)) return 'aidoc-illustration'
  return null
}

function replyFor(text: string, tool: ChatboxTool | null) {
  const docName = documentContext.value?.name
  if (!editorReady.value) return '编辑器还没就绪，请稍后再试。'
  if (tool === 'stream') return `好的，开始向${docName ? `「${docName}」` : '文档'}流式写入一段说明，写入期间文档会暂时锁定。`
  if (tool === 'generate-toc') return '正在根据当前文档结构生成目录，并写入光标位置。'
  if (tool === 'write-analysis') return '正在把刚才的文档分析写入正文。写入时请不要同时编辑。'
  if (tool) return `收到，开始执行「${text}」相关的文档操作。`
  return '可以。需要改文档时，直接说「生成目录」「写入分析」或「流式写入」。也可以先问我文档怎么组织。'
}

async function sendText(text: string) {
  const content = text.trim()
  if (!content || sending.value) return

  draft.value = ''
  sending.value = true
  messages.value.push({ id: ++messageSeq, role: 'user', text: content })
  scrollToBottom()

  const tool = detectTool(content)
  await new Promise((resolve) => window.setTimeout(resolve, 420))
  messages.value.push({ id: ++messageSeq, role: 'assistant', text: replyFor(content, tool) })
  scrollToBottom()

  if (tool) postToHost({ type: 'run-tool', tool })
  sending.value = false
  void nextTick(() => inputRef.value?.focus())
}

function submitDraft() {
  void sendText(draft.value)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submitDraft()
  }
}

function handleHostMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return
  const data = event.data as { source?: string; type?: string }
  if (!data || data.source !== HOST_SOURCE) return

  if (data.type === 'context') {
    const payload = event.data as { document: ChatboxDocumentContext | null; editorReady: boolean }
    documentContext.value = payload.document
    editorReady.value = payload.editorReady
    return
  }

  if (data.type === 'ai-status') {
    hostProcessing.value = Boolean((event.data as { processing?: boolean }).processing)
  }
}

onMounted(() => {
  window.addEventListener('message', handleHostMessage)
  postToHost({ type: 'ready' })
  inputRef.value?.focus()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleHostMessage)
})
</script>

<template>
  <div class="chatbox-page">
    <header class="chatbox-head">
      <div>
        <strong>AI 助手</strong>
        <p>{{ hint }}</p>
      </div>
      <span class="chatbox-dot" :class="{ on: editorReady, busy: hostProcessing }" />
    </header>

    <div ref="listRef" class="chatbox-list">
      <div
        v-for="item in messages"
        :key="item.id"
        class="bubble"
        :class="item.role"
      >
        {{ item.text }}
      </div>
    </div>

    <div class="chatbox-dock">
      <div class="quick-row">
        <button
          v-for="action in quickActions"
          :key="action.tool"
          type="button"
          :disabled="sending || hostProcessing || !editorReady"
          @click="sendText(action.label)"
        >
          {{ action.label }}
        </button>
      </div>
      <div class="composer">
        <textarea
          ref="inputRef"
          v-model="draft"
          rows="2"
          :disabled="sending"
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          @keydown="onKeydown"
        />
        <button type="button" class="send-btn" :disabled="sending || !draft.trim()" @click="submitDraft">
          <SendOutlined />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chatbox-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #fff;
}

.chatbox-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid #eef2f6;
}

.chatbox-head strong {
  display: block;
  font-size: 14px;
  font-weight: 650;
}

.chatbox-head p {
  margin: 3px 0 0;
  overflow: hidden;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chatbox-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #cbd5e1;
}

.chatbox-dot.on {
  background: #22c55e;
}

.chatbox-dot.busy {
  background: #2563eb;
  box-shadow: 0 0 0 4px #dbeafe;
}

.chatbox-list {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  overflow: auto;
  background: #f7f9fc;
}

.bubble {
  max-width: 88%;
  padding: 8px 11px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble.assistant {
  align-self: flex-start;
  color: #1e293b;
  background: #fff;
  border: 1px solid #e8edf3;
}

.bubble.user {
  align-self: flex-end;
  color: #fff;
  background: #2563eb;
}

.chatbox-dock {
  flex-shrink: 0;
  padding: 10px 12px 12px;
  border-top: 1px solid #eef2f6;
  background: #fff;
}

.quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.quick-row button {
  padding: 4px 8px;
  border: 1px solid #dbe4f0;
  border-radius: 999px;
  color: #334155;
  background: #f8fafc;
  cursor: pointer;
  font-size: 12px;
}

.quick-row button:hover:not(:disabled) {
  border-color: #93c5fd;
  color: #1d4ed8;
  background: #eff6ff;
}

.quick-row button:disabled,
.send-btn:disabled {
  cursor: not-allowed;
  opacity: .45;
}

.composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.composer textarea {
  min-height: 44px;
  max-height: 96px;
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  resize: none;
  outline: none;
  color: #1e293b;
  background: #f8fafc;
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
}

.composer textarea:focus {
  border-color: #93c5fd;
  background: #fff;
}

.send-btn {
  display: grid;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  place-items: center;
  border: 0;
  border-radius: 10px;
  color: #fff;
  background: #2563eb;
  cursor: pointer;
}
</style>
