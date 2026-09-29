export interface WopiLaunchInfo {
  fileId: string
  fileName: string
  accessToken: string
  wopiSrc: string
  downloadUrl: string
  version: number
  updatedAt: string
}

export interface CollaboraExportFormat {
  label: string
  format: string
}

export interface CollaboraMessage {
  MessageId?: string
  Values?: unknown
  [key: string]: unknown
}
