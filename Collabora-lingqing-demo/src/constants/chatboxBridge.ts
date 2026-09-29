export const CHATBOX_SOURCE = 'aidoc-chatbox'
export const HOST_SOURCE = 'aidoc-host'

export type ChatboxDocumentContext = {
  id: number
  name: string
  type: string
  major: string
  status: string
  goal: string
  description: string
}

export type ChatboxTool = 'stream' | 'write-analysis' | 'generate-toc' | string

export type ChatboxToHostMessage =
  | { source: typeof CHATBOX_SOURCE; type: 'ready' }
  | { source: typeof CHATBOX_SOURCE; type: 'run-tool'; tool: ChatboxTool }

export type HostToChatboxMessage =
  | {
      source: typeof HOST_SOURCE
      type: 'context'
      document: ChatboxDocumentContext | null
      editorReady: boolean
    }
  | { source: typeof HOST_SOURCE; type: 'ai-status'; processing: boolean }

export function isChatboxToHostMessage(value: unknown): value is ChatboxToHostMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as { source?: unknown; type?: unknown }
  return message.source === CHATBOX_SOURCE && typeof message.type === 'string'
}
