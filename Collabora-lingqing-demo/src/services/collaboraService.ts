import type { WopiLaunchInfo } from '@/types/collabora'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function validateDocx(file: File): string | null {
  if (!/\.docx$/i.test(file.name) && file.type !== DOCX_MIME) {
    return '仅支持 .docx 格式的 Word 文档'
  }
  if (file.size === 0) return '不能上传空文件'
  return null
}

export async function uploadDocx(file: File): Promise<WopiLaunchInfo> {
  const response = await fetch(`/api/collabora/files?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || DOCX_MIME,
    },
    body: file,
  })

  const payload = (await response.json()) as WopiLaunchInfo & { error?: string }
  if (!response.ok) throw new Error(payload.error || '上传失败')
  return payload
}

export async function refreshFileStatus(info: WopiLaunchInfo): Promise<WopiLaunchInfo> {
  const response = await fetch(
    `/api/collabora/files/${encodeURIComponent(info.fileId)}/status?access_token=${encodeURIComponent(info.accessToken)}`,
  )
  const payload = (await response.json()) as WopiLaunchInfo & { error?: string }
  if (!response.ok) throw new Error(payload.error || '读取保存状态失败')
  return payload
}

export interface TemplateDocumentPayload {
  fileName: string
  title?: string
  blocks: Array<{ type: 'heading1' | 'heading2' | 'paragraph'; text: string }>
}

export async function openFromTemplate(payload: TemplateDocumentPayload): Promise<WopiLaunchInfo> {
  const response = await fetch('/api/collabora/files/from-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = (await response.json()) as WopiLaunchInfo & { error?: string }
  if (!response.ok) throw new Error(result.error || '打开文档失败')
  return result
}
