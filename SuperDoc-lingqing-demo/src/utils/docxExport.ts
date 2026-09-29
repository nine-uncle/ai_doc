import type { ExportParams } from 'superdoc'

export interface SuperDocExporter {
  export(params?: ExportParams): Promise<Blob>
}

/** 根据源文件名生成导出文件名（不含扩展名） */
export function resolveDocxExportName(sourceFileName?: string | null): string {
  if (sourceFileName) {
    const stem = sourceFileName.replace(/\.docx$/i, '').trim()
    if (stem) return `${stem}-已编辑`
  }
  return '灵清文档'
}

/**
 * 通过 SuperDoc 原生 OOXML 导出链路写回 .docx，最大程度保留样式、版式与结构。
 * 上传 docx 后经 replaceFile 加载的文档走同一套序列化路径。
 */
export async function exportSuperDocAsDocx(
  superdoc: SuperDocExporter,
  options: {
    exportedName?: string
    triggerDownload?: boolean
  } = {},
): Promise<Blob> {
  const { exportedName, triggerDownload = true } = options

  return superdoc.export({
    exportType: ['docx'],
    // v2 worker save 尚不支持 commentExportMode="strip"（即 commentsType: 'clean'），
    // 需用 preserve 才能正常导出；本 Demo 未启用批注模块，preserve 不影响格式。
    commentsType: 'external',
    isFinalDoc: false,
    triggerDownload,
    exportedName,
  })
}
