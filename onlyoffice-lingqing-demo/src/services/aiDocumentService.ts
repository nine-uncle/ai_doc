import type { AiActionPayload, AiActionResult } from '@/types/aiAction'
import { AI_ACTION_LABELS } from '@/types/aiAction'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mockAiDocumentAction(payload: AiActionPayload): Promise<AiActionResult> {
  await delay(900)

  const label = AI_ACTION_LABELS[payload.action]
  const preview = payload.text.length > 24 ? `${payload.text.slice(0, 24)}…` : payload.text

  return {
    message: `${label}请求已提交（模拟）：「${preview}」`,
  }
}

export async function callAiDocumentAction(payload: AiActionPayload): Promise<AiActionResult> {
  try {
    const response = await fetch('/api/ai/document-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return (await response.json()) as AiActionResult
  } catch {
    return mockAiDocumentAction(payload)
  }
}
