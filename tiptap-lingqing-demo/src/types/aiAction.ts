export type AiDocumentAction = 'expand' | 'polish' | 'generate-image' | 'summarize'

export interface AiActionPayload {
  action: AiDocumentAction
  text: string
  from: number
  to: number
}

export interface AiActionResult {
  message: string
}

export const AI_ACTION_LABELS: Record<AiDocumentAction, string> = {
  expand: '扩写',
  polish: '润色',
  'generate-image': '生成图片',
  summarize: '摘要',
}

export const AI_SELECTION_ACTIONS: AiDocumentAction[] = [
  'expand',
  'polish',
  'generate-image',
  'summarize',
]
