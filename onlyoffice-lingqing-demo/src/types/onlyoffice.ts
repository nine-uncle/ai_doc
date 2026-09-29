export interface OnlyOfficeUser {
  id: string
  name: string
}

export interface OnlyOfficePermissions {
  edit?: boolean
  download?: boolean
  print?: boolean
  review?: boolean
  comment?: boolean
}

export interface OnlyOfficeDocument {
  title: string
  url: string
  fileType: string
  key: string
  permissions?: OnlyOfficePermissions
}

export interface OnlyOfficeEditorConfig {
  callbackUrl: string
  user: OnlyOfficeUser
  lang: string
  mode: 'edit' | 'view'
  customization?: Record<string, unknown>
}

export interface OnlyOfficeConfig {
  documentType: 'word'
  document: OnlyOfficeDocument
  editorConfig: OnlyOfficeEditorConfig
  _meta?: {
    onlyofficeServerUrl: string
    documentId: string
  }
}
