import type {
  DocumentItem,
  DocumentListQuery,
  DocumentListResult,
  DocumentStats,
  DocumentWritePayload,
} from '@/types/document'

const STORAGE_KEY = 'aidoc-mock-documents'
const MOCK_DELAY_MS = 220
export const CURRENT_USER_NAME = '张工'

const seedDocuments: DocumentItem[] = [
  {
    id: 1,
    name: '某型号结构件军检记录',
    description: '依据最新标准规范和历史记录，生成可补充、可校验、可追溯的军检记录。',
    type: '制式文档',
    template: '军检结构化记录模板 V2',
    status: '编写中',
    version: 'V1.3',
    progress: '自动快照 4 · 里程碑 2',
    owner: '张工',
    members: [
      { name: '张工', role: '拥有者', owner: true },
      { name: '李工', role: '编辑者' },
      { name: '陈工', role: '阅读者' },
    ],
    updatedAt: '2026-07-12 16:20',
    issues: 3,
    archived: false,
    major: '结构',
    project: 'XX-2026-A 结构件 / 202607-03 批次',
    goal: '依据最新标准规范、图纸和历史质量记录，形成可补充、可校验、可追溯的军检记录。',
    referenceFiles: [],
  },
  {
    id: 2,
    name: '工艺评审检查清单',
    description: '覆盖关键工序评审项，记录不符合项与闭环情况。',
    type: '制式文档',
    template: '工艺评审模板 V1',
    status: '草稿',
    version: 'V0.8',
    progress: '自动快照 1 · 里程碑 0',
    owner: '李工',
    members: [
      { name: '李工', role: '拥有者', owner: true },
      { name: '张工', role: '编辑者' },
    ],
    updatedAt: '2026-07-10 09:12',
    issues: 1,
    archived: false,
    major: '工艺',
    project: '工艺评审专项',
    goal: '覆盖关键工序评审项，记录不符合项与闭环情况。',
    referenceFiles: [],
  },
  {
    id: 3,
    name: '质量问题追溯报告',
    description: '关联批次、图纸与历史质量记录，形成可追溯报告。',
    type: '普通文档',
    template: '质量追溯模板 V3',
    status: '编写中',
    version: 'V2.1',
    progress: '自动快照 6 · 里程碑 3',
    owner: '陈工',
    members: [
      { name: '陈工', role: '拥有者', owner: true },
      { name: '张工', role: '阅读者' },
      { name: '王工', role: '编辑者' },
    ],
    updatedAt: '2026-07-08 14:41',
    issues: 5,
    archived: false,
    major: '质量',
    project: '质量追溯专项',
    goal: '关联批次、图纸与历史质量记录，形成可追溯报告。',
    referenceFiles: [],
  },
  {
    id: 4,
    name: '结构件交付验收记录',
    description: '按验收大纲核对交付物完整性与符合性。',
    type: '制式文档',
    template: '交付验收模板 V1',
    status: '已完成',
    version: 'V3.0',
    progress: '自动快照 9 · 里程碑 4',
    owner: '王工',
    members: [
      { name: '王工', role: '拥有者', owner: true },
      { name: '李工', role: '阅读者' },
      { name: '张工', role: '阅读者' },
    ],
    updatedAt: '2026-06-28 11:05',
    issues: 0,
    archived: false,
    major: '结构',
    project: '结构件交付验收',
    goal: '按验收大纲核对交付物完整性与符合性。',
    referenceFiles: [],
  },
  {
    id: 5,
    name: '2025 年度归档军检记录',
    description: '历史军检记录归档副本，仅保留查阅与追溯。',
    type: '制式文档',
    template: '军检结构化记录模板 V2',
    status: '已完成',
    version: 'V1.0',
    progress: '自动快照 2 · 里程碑 1',
    owner: '张工',
    members: [{ name: '张工', role: '拥有者', owner: true }],
    updatedAt: '2025-12-20 18:00',
    issues: 0,
    archived: true,
    major: '结构',
    project: '2025 年度归档',
    goal: '历史军检记录归档副本，仅保留查阅与追溯。',
    referenceFiles: [],
  },
]

function cloneDocument(document: DocumentItem): DocumentItem {
  return {
    ...document,
    members: document.members.map((member) => ({ ...member })),
    referenceFiles: [...document.referenceFiles],
  }
}

function wait() {
  return new Promise((resolve) => window.setTimeout(resolve, MOCK_DELAY_MS))
}

function formatNow() {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function canAccess(document: DocumentItem) {
  return document.owner === CURRENT_USER_NAME || document.members.some((member) => member.name === CURRENT_USER_NAME)
}

function isCreatedByMe(document: DocumentItem) {
  return document.owner === CURRENT_USER_NAME
}

function isJoinedByMe(document: DocumentItem) {
  return !isCreatedByMe(document) && document.members.some((member) => member.name === CURRENT_USER_NAME)
}

function readStore(): DocumentItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedDocuments.map(cloneDocument)
    const parsed = JSON.parse(raw) as DocumentItem[]
    if (!Array.isArray(parsed) || parsed.length === 0) return seedDocuments.map(cloneDocument)
    return parsed.map(cloneDocument)
  } catch {
    return seedDocuments.map(cloneDocument)
  }
}

function writeStore(documents: DocumentItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documents))
}

function nextId(documents: DocumentItem[]) {
  return documents.reduce((max, document) => Math.max(max, document.id), 0) + 1
}

function matchScope(document: DocumentItem, scope: DocumentListQuery['scope']) {
  if (!canAccess(document)) return false
  if (scope === 'archived') return document.archived
  if (document.archived) return false
  if (scope === 'created') return isCreatedByMe(document)
  if (scope === 'joined') return isJoinedByMe(document)
  return true
}

function filterDocuments(documents: DocumentItem[], query: DocumentListQuery) {
  const keyword = query.keyword?.trim().toLowerCase() ?? ''
  return documents.filter((document) => {
    if (!matchScope(document, query.scope)) return false
    if (
      keyword &&
      !`${document.name}${document.template}${document.owner}${document.project}`.toLowerCase().includes(keyword)
    ) {
      return false
    }
    if (query.type && query.type !== 'all' && document.type !== query.type) return false
    if (query.status && query.status !== 'all' && document.status !== query.status) return false
    if (query.major && query.major !== 'all' && document.major !== query.major) return false
    return true
  })
}

export async function getDocumentStats(): Promise<DocumentStats> {
  await wait()
  const documents = readStore()
  return {
    created: documents.filter((document) => !document.archived && isCreatedByMe(document) && canAccess(document)).length,
    joined: documents.filter((document) => !document.archived && isJoinedByMe(document)).length,
    all: documents.filter((document) => !document.archived && canAccess(document)).length,
    archived: documents.filter((document) => document.archived && canAccess(document)).length,
  }
}

export async function listDocuments(query: DocumentListQuery): Promise<DocumentListResult> {
  await wait()
  const filtered = filterDocuments(readStore(), query)
  const start = (query.page - 1) * query.pageSize
  return {
    list: filtered.slice(start, start + query.pageSize).map(cloneDocument),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export async function createDocument(payload: DocumentWritePayload): Promise<DocumentItem> {
  await wait()
  const documents = readStore()
  const name = payload.name.trim()
  if (!name) throw new Error('请输入文档名称')

  const description = payload.goal?.trim() || payload.project?.trim() || '新建文档'
  const created: DocumentItem = {
    id: nextId(documents),
    name,
    description,
    type: payload.type || '制式文档',
    template: payload.template || (payload.importFileName ? '导入文档模板 V1' : '通用编写模板 V1'),
    status: payload.status || (payload.importFileName ? '编写中' : '草稿'),
    version: 'V0.1',
    progress: '自动快照 0 · 里程碑 0',
    owner: CURRENT_USER_NAME,
    members: [{ name: CURRENT_USER_NAME, role: '拥有者', owner: true }],
    updatedAt: formatNow(),
    issues: 0,
    archived: false,
    major: payload.major || '结构',
    project: payload.project?.trim() || '',
    goal: payload.goal?.trim() || '',
    referenceFiles: payload.referenceFiles ?? [],
    importFileName: payload.importFileName,
  }
  documents.unshift(created)
  writeStore(documents)
  return cloneDocument(created)
}

export async function updateDocument(id: number, payload: DocumentWritePayload): Promise<DocumentItem> {
  await wait()
  const documents = readStore()
  const index = documents.findIndex((document) => document.id === id)
  if (index < 0) throw new Error('文档不存在')

  const name = payload.name.trim()
  if (!name) throw new Error('请输入文档名称')

  const current = documents[index]
  const updated: DocumentItem = {
    ...current,
    name,
    description: payload.goal?.trim() || payload.project?.trim() || current.description,
    type: payload.type || current.type,
    status: payload.status || current.status,
    major: payload.major || current.major,
    project: payload.project?.trim() ?? current.project,
    goal: payload.goal?.trim() ?? current.goal,
    referenceFiles: payload.referenceFiles ?? current.referenceFiles,
    updatedAt: formatNow(),
  }
  documents[index] = updated
  writeStore(documents)
  return cloneDocument(updated)
}

export async function copyDocument(id: number): Promise<DocumentItem> {
  await wait()
  const documents = readStore()
  const source = documents.find((document) => document.id === id)
  if (!source) throw new Error('文档不存在')

  const copied: DocumentItem = {
    ...cloneDocument(source),
    id: nextId(documents),
    name: `${source.name}（副本）`,
    status: '草稿',
    version: 'V0.1',
    progress: '自动快照 0 · 里程碑 0',
    owner: CURRENT_USER_NAME,
    members: [{ name: CURRENT_USER_NAME, role: '拥有者', owner: true }],
    archived: false,
    issues: 0,
    updatedAt: formatNow(),
  }
  documents.unshift(copied)
  writeStore(documents)
  return cloneDocument(copied)
}

export async function deleteDocument(id: number): Promise<void> {
  await wait()
  const documents = readStore()
  const next = documents.filter((document) => document.id !== id)
  if (next.length === documents.length) throw new Error('文档不存在')
  writeStore(next)
}

export async function getDocumentById(id: number): Promise<DocumentItem | null> {
  const document = readStore().find((item) => item.id === id)
  return document ? cloneDocument(document) : null
}
