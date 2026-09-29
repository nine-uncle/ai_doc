export type DocumentTabKey = 'created' | 'joined' | 'all' | 'archived'

export interface DocumentMember {
  name: string
  role: string
  owner?: boolean
}

export interface DocumentItem {
  id: number
  name: string
  description: string
  type: string
  template: string
  status: string
  version: string
  progress: string
  owner: string
  members: DocumentMember[]
  updatedAt: string
  issues: number
  archived: boolean
  major: string
  project: string
  goal: string
  referenceFiles: string[]
  importFileName?: string
}

export interface DocumentStats {
  created: number
  joined: number
  all: number
  archived: number
}

export interface DocumentListQuery {
  scope: DocumentTabKey
  keyword?: string
  type?: string
  status?: string
  major?: string
  page: number
  pageSize: number
}

export interface DocumentListResult {
  list: DocumentItem[]
  total: number
  page: number
  pageSize: number
}

export interface DocumentWritePayload {
  name: string
  project?: string
  goal?: string
  type?: string
  status?: string
  major?: string
  template?: string
  referenceFiles?: string[]
  importFileName?: string
}
