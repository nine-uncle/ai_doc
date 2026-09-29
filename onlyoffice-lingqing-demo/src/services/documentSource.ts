import { DEFAULT_DOCX_NAME, DEFAULT_DOCX_URL } from '@/constants/document'

export function resolveOnlyOfficeDocumentSource(file: File | null): {
  url: string
  title: string
  usesFallback: boolean
} {
  if (!file) {
    return {
      url: DEFAULT_DOCX_URL,
      title: DEFAULT_DOCX_NAME,
      usesFallback: false,
    }
  }

  return {
    url: DEFAULT_DOCX_URL,
    title: file.name,
    usesFallback: true,
  }
}
