import type { OnlyOfficeConfig } from '@/types/onlyoffice'

export function buildOnlyOfficeConfig(options: {
  documentId: string
  documentUrl: string
  documentTitle: string
  mode: 'edit' | 'view'
  loadKey: number
}): OnlyOfficeConfig {
  const onlyofficeServerUrl =
    import.meta.env.VITE_ONLYOFFICE_SERVER_URL || 'http://localhost:8080'
  const baseUrl = window.location.origin
  const isView = options.mode === 'view'

  return {
    documentType: 'word',
    document: {
      title: options.documentTitle,
      url: options.documentUrl,
      fileType: 'docx',
      key: `${options.documentId}-${options.loadKey}`,
      permissions: {
        edit: !isView,
        download: true,
        print: true,
        review: !isView,
        comment: !isView,
      },
    },
    editorConfig: {
      callbackUrl: `${baseUrl}/mock-onlyoffice-callback`,
      user: {
        id: 'u-lingqing',
        name: '灵清用户',
      },
      lang: 'zh-CN',
      mode: isView ? 'view' : 'edit',
      customization: {
        autosave: !isView,
        compactHeader: false,
        compactToolbar: false,
        forcesave: !isView,
        toolbarNoTabs: false,
      },
    },
    _meta: {
      onlyofficeServerUrl,
      documentId: options.documentId,
    },
  }
}
