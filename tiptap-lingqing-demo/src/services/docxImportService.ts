import { parseDOCX } from '@docen/import-docx'
import type { JSONContent } from '@tiptap/core'
import type { DocxImportReport } from '@/types/document'

function countNodes(doc: JSONContent): DocxImportReport {
  const report: DocxImportReport = {
    headingCount: 0,
    paragraphCount: 0,
    tableCount: 0,
    imageCount: 0,
    listCount: 0,
    styledTextCount: 0,
  }

  function walk(node: JSONContent) {
    switch (node.type) {
      case 'heading':
        report.headingCount += 1
        break
      case 'paragraph':
        report.paragraphCount += 1
        break
      case 'table':
        report.tableCount += 1
        break
      case 'image':
        report.imageCount += 1
        break
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        report.listCount += 1
        break
      case 'text':
        if (node.marks?.length) {
          report.styledTextCount += 1
        }
        break
      default:
        break
    }

    node.content?.forEach(walk)
  }

  walk(doc)
  return report
}

export async function importDocxFile(file: File): Promise<{
  fileName: string
  content: JSONContent
  report: DocxImportReport
}> {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('仅支持 .docx 文件')
  }

  const buffer = await file.arrayBuffer()
  const content = await parseDOCX(buffer)

  return {
    fileName: file.name,
    content,
    report: countNodes(content),
  }
}
