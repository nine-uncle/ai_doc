<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { PlusOutlined } from '@nancal-icon/icons-vue'
import type { TableColumnsType, UploadProps } from 'n-designv3'
import { Modal, message } from 'n-designv3'
import { AIDOC_EDITOR_PATH } from '../router'
import type { DocumentItem, DocumentStats, DocumentTabKey } from '@/types/document'
import {
  copyDocument,
  createDocument,
  deleteDocument,
  getDocumentStats,
  listDocuments,
  updateDocument,
} from '@/services/documentMockService'

type ReferenceUploadFile = Parameters<NonNullable<UploadProps['beforeUpload']>>[0]
type DocumentForm = {
  name: string
  project: string
  goal: string
  type: string
  status: string
  major: string
}

const activeTab = ref<DocumentTabKey>('created')
const keyword = ref('')
const documentType = ref('all')
const progress = ref('all')
const major = ref('all')
const selectedIds = ref<number[]>([])
const loading = ref(false)
const saving = ref(false)
const isFormDrawerOpen = ref(false)
const editingId = ref<number | null>(null)
const tableContentRef = ref<HTMLElement | null>(null)
const tableScrollbarWidth = ref(0)
let tableBodyObserver: ResizeObserver | null = null
let listRequestId = 0
const paginationState = reactive({
  current: 1,
  pageSize: 10,
})
const listTotal = ref(0)
const documents = ref<DocumentItem[]>([])
const stats = ref<DocumentStats>({ created: 0, joined: 0, all: 0, archived: 0 })
const createMode = ref<'new' | 'import'>('new')
const documentNameInput = ref<{ focus: () => void } | null>(null)
const referenceFiles = ref<string[]>([])
const importFileName = ref('')
const createForm = ref<DocumentForm>(emptyForm())

function emptyForm(): DocumentForm {
  return {
    name: '',
    project: '',
    goal: '',
    type: '制式文档',
    status: '草稿',
    major: '结构',
  }
}

const isEditing = computed(() => editingId.value !== null)

const tabs = computed(() => [
  { key: 'created' as const, label: '我创建的', count: stats.value.created, hint: '我是拥有者、可管理权限的文档', action: '进入列表', theme: 'blue' as const },
  { key: 'joined' as const, label: '我参与的', count: stats.value.joined, hint: '我是编辑者或阅读者的协作文档', action: '进入列表', theme: 'rose' as const },
  { key: 'all' as const, label: '全部文档', count: stats.value.all, hint: '当前账号有访问权限的全部文档', action: '进入列表', theme: 'green' as const },
  { key: 'archived' as const, label: '已归档', count: stats.value.archived, hint: '保留版本与追溯记录的历史文档', action: '查看归档', theme: 'gold' as const },
])

const documentTypeOptions = [
  { label: '全部类型', value: 'all' },
  { label: '制式文档', value: '制式文档' },
  { label: '普通文档', value: '普通文档' },
]
const progressOptions = [
  { label: '全部进展', value: 'all' },
  { label: '编写中', value: '编写中' },
  { label: '草稿', value: '草稿' },
  { label: '已完成', value: '已完成' },
]
const majorOptions = [
  { label: '全部专业', value: 'all' },
  { label: '结构', value: '结构' },
  { label: '工艺', value: '工艺' },
  { label: '质量', value: '质量' },
]

const tableColumns: TableColumnsType<DocumentItem> = [
  {
    title: '序号',
    dataIndex: 'index',
    width: 64,
    align: 'center',
  },
  { title: '文档名称', dataIndex: 'name', width: 240, ellipsis: true },
  { title: '类型', dataIndex: 'type', width: 100 },
  { title: '模板', dataIndex: 'template', width: 180, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '版本', dataIndex: 'version', width: 100 },
  { title: '负责人', dataIndex: 'owner', width: 88 },
  { title: '成员', dataIndex: 'members', width: 260 },
  { title: '更新时间', dataIndex: 'updatedAt', width: 160 },
  { title: '校验问题', dataIndex: 'issues', width: 110 },
  { title: '操作', dataIndex: 'action', width: 220, fixed: 'right' },
]

const pagination = computed(() => ({
  current: paginationState.current,
  pageSize: paginationState.pageSize,
  total: listTotal.value,
  showSizeChanger: true,
  showQuickJumper: true,
  pageSizeOptions: ['10', '20', '30', '40', '50'],
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (page: number, pageSizeVal?: number) => {
    paginationState.current = page
    paginationState.pageSize = pageSizeVal ?? paginationState.pageSize
  },
}))

const rowSelection = computed(() => ({
  selectedRowKeys: selectedIds.value,
  columnWidth: 48,
  onChange: (keys: (string | number)[]) => {
    selectedIds.value = keys.map(Number)
  },
}))

const drawerTitle = computed(() => (isEditing.value ? '编辑文档' : '创建文档'))
const submitLabel = computed(() => {
  if (isEditing.value) return '保存'
  return createMode.value === 'new' ? '创建' : '导入'
})

async function fetchList() {
  const requestId = ++listRequestId
  loading.value = true
  try {
    const [listResult, nextStats] = await Promise.all([
      listDocuments({
        scope: activeTab.value,
        keyword: keyword.value,
        type: documentType.value,
        status: progress.value,
        major: major.value,
        page: paginationState.current,
        pageSize: paginationState.pageSize,
      }),
      getDocumentStats(),
    ])
    if (requestId !== listRequestId) return
    const maxPage = Math.max(1, Math.ceil(listResult.total / paginationState.pageSize) || 1)
    if (paginationState.current > maxPage) {
      paginationState.current = maxPage
      return
    }
    documents.value = listResult.list
    listTotal.value = listResult.total
    stats.value = nextStats
  } catch (error) {
    if (requestId !== listRequestId) return
    message.error(error instanceof Error ? error.message : '加载文档列表失败')
  } finally {
    if (requestId === listRequestId) loading.value = false
  }
}

watch(activeTab, () => {
  selectedIds.value = []
  paginationState.current = 1
})

watch([documentType, progress, major], () => {
  paginationState.current = 1
})

watch(
  [activeTab, documentType, progress, major, () => paginationState.current, () => paginationState.pageSize],
  () => {
    void fetchList()
  },
  { immediate: true },
)

watch(isFormDrawerOpen, async (open) => {
  if (!open) return
  await nextTick()
  documentNameInput.value?.focus()
})

function onSearch() {
  paginationState.current = 1
  void fetchList()
}

function resetFilters() {
  keyword.value = ''
  documentType.value = 'all'
  progress.value = 'all'
  major.value = 'all'
  paginationState.current = 1
  void fetchList()
}

function resetDrawerState() {
  editingId.value = null
  createMode.value = 'new'
  createForm.value = emptyForm()
  referenceFiles.value = []
  importFileName.value = ''
}

function openCreateDrawer() {
  resetDrawerState()
  isFormDrawerOpen.value = true
}

function openEditDrawer(document: DocumentItem) {
  editingId.value = document.id
  createMode.value = document.importFileName ? 'import' : 'new'
  createForm.value = {
    name: document.name,
    project: document.project,
    goal: document.goal,
    type: document.type,
    status: document.status,
    major: document.major,
  }
  referenceFiles.value = [...document.referenceFiles]
  importFileName.value = document.importFileName ?? ''
  isFormDrawerOpen.value = true
}

function closeFormDrawer() {
  isFormDrawerOpen.value = false
  resetDrawerState()
}

function editorHref(id: number) {
  return `${AIDOC_EDITOR_PATH}?id=${id}`
}

async function submitDocumentForm() {
  if (!createForm.value.name.trim()) {
    documentNameInput.value?.focus()
    message.warning('请输入文档名称')
    return
  }
  if (!isEditing.value && createMode.value === 'import' && !importFileName.value) {
    message.warning('请选择要导入的文档')
    return
  }

  saving.value = true
  try {
    if (isEditing.value && editingId.value !== null) {
      await updateDocument(editingId.value, {
        ...createForm.value,
        referenceFiles: referenceFiles.value,
      })
      message.success('文档已保存')
    } else {
      await createDocument({
        ...createForm.value,
        referenceFiles: referenceFiles.value,
        importFileName: createMode.value === 'import' ? importFileName.value : undefined,
        template: createMode.value === 'import' ? '导入文档模板 V1' : '通用编写模板 V1',
      })
      message.success(createMode.value === 'import' ? '文档已导入' : '文档已创建')
      activeTab.value = 'created'
      paginationState.current = 1
    }
    closeFormDrawer()
    await fetchList()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function beforeReferenceUpload(file: ReferenceUploadFile) {
  referenceFiles.value = [...new Set([...referenceFiles.value, file.name])]
  return false
}

function beforeImportUpload(file: ReferenceUploadFile) {
  importFileName.value = file.name
  if (!createForm.value.name.trim()) {
    createForm.value.name = file.name.replace(/\.docx$/i, '')
  }
  return false
}

function removeReferenceFile(fileName: string) {
  referenceFiles.value = referenceFiles.value.filter((name) => name !== fileName)
}

async function duplicateDocument(document: DocumentItem) {
  try {
    await copyDocument(document.id)
    message.success('已复制为新文档')
    activeTab.value = 'created'
    paginationState.current = 1
    await fetchList()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '复制失败')
  }
}

function confirmDeleteDocument(document: DocumentItem) {
  Modal.confirm({
    title: '确认删除',
    content: `确定删除「${document.name}」吗？删除后无法恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await deleteDocument(document.id)
      selectedIds.value = selectedIds.value.filter((id) => id !== document.id)
      message.success('文档已删除')
      await fetchList()
    },
  })
}

function getTableBody() {
  return tableContentRef.value?.querySelector('.nl-table-body, .ant-table-body') as HTMLElement | null
}

function syncTableScrollbar() {
  const body = getTableBody()
  if (!body) {
    tableScrollbarWidth.value = 0
    return
  }
  tableScrollbarWidth.value = Math.max(0, body.offsetWidth - body.clientWidth)
}

function bindTableObserver() {
  tableBodyObserver?.disconnect()
  const body = getTableBody()
  if (!body || !tableContentRef.value) return
  tableBodyObserver = new ResizeObserver(() => syncTableScrollbar())
  tableBodyObserver.observe(tableContentRef.value)
  tableBodyObserver.observe(body)
  syncTableScrollbar()
}

onMounted(() => {
  nextTick(() => requestAnimationFrame(bindTableObserver))
})

watch(
  [documents, () => paginationState.current, () => paginationState.pageSize],
  async () => {
    await nextTick()
    bindTableObserver()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  tableBodyObserver?.disconnect()
})
</script>

<template>
  <div class="documents-page">
    <div class="page-top">
      <div class="tab-blocks" role="tablist" aria-label="文档分类">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-block"
        :class="[`tab-block--${tab.theme}`, { active: activeTab === tab.key }]"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.key"
        @click="activeTab = tab.key"
      >
        <strong>{{ tab.label }}</strong>
        <p>{{ tab.hint }}</p>
        <span>{{ tab.action }} {{ tab.count }} 份 ></span>
        <svg class="tab-block-mark" viewBox="0 0 48 48" aria-hidden="true">
          <g v-if="tab.theme === 'blue'">
            <rect x="8" y="22" width="32" height="8" rx="2" />
            <rect x="12" y="14" width="24" height="8" rx="2" />
            <rect x="16" y="6" width="16" height="8" rx="2" />
          </g>
          <g v-else-if="tab.theme === 'rose'">
            <circle cx="18" cy="16" r="6" />
            <circle cx="30" cy="16" r="6" />
            <path d="M8 38c2-8 8-12 16-12s14 4 16 12" fill="none" stroke="currentColor" stroke-width="4" />
          </g>
          <g v-else-if="tab.theme === 'green'">
            <rect x="10" y="6" width="22" height="30" rx="3" />
            <path d="M16 16h10M16 22h10M16 28h7" fill="none" stroke="currentColor" stroke-width="3" />
            <rect x="26" y="18" width="12" height="18" rx="2" />
          </g>
          <g v-else>
            <rect x="10" y="16" width="28" height="20" rx="3" />
            <path d="M10 22h28M18 16v-4h12v4" fill="none" stroke="currentColor" stroke-width="3" />
          </g>
        </svg>
      </button>
    </div>

    <div class="search-area">
      <div class="search-area-left">
        <NInputSearch
          v-model:value="keyword"
          style="width: 240px"
          allow-clear
          placeholder="搜索文档名称..."
          enter-button="查询"
          @search="onSearch"
        />
        <NSelect v-model:value="documentType" style="width: 132px" :options="documentTypeOptions" />
        <NSelect v-model:value="progress" style="width: 132px" :options="progressOptions" />
        <NSelect v-model:value="major" style="width: 120px" :options="majorOptions" />
        <NButton @click="resetFilters">重置</NButton>
      </div>
      <div class="search-area-right">
        <NButton v-if="selectedIds.length" :disabled="selectedIds.length === 0">
          批量校验{{ selectedIds.length ? ` (${selectedIds.length})` : '' }}
        </NButton>
        <NButton type="primary" @click="openCreateDrawer">
          <template #icon><PlusOutlined /></template>
          创建文档
        </NButton>
      </div>
    </div>
    </div>

    <div class="page-main">
      <div class="table-area">
        <div
          ref="tableContentRef"
          class="table-content"
          :class="{ 'has-y-scroll': tableScrollbarWidth > 0 }"
          :style="{ '--table-scrollbar-width': `${tableScrollbarWidth}px` }"
        >
          <NTable
          row-key="id"
          :loading="loading"
          :columns="tableColumns"
          :data-source="documents"
          :pagination="false"
          :row-selection="rowSelection"
          :scroll="{ x: 1280, y: 'calc(100vh - 200px)' }"
        >
          <template #bodyCell="{ column, record: document, index }">
            <template v-if="column.dataIndex === 'index'">
              {{ (paginationState.current - 1) * paginationState.pageSize + index + 1 }}
            </template>
            <template v-else-if="column.dataIndex === 'name'">
              <span class="name-text" :title="document.description">{{ document.name }}</span>
            </template>
            <template v-else-if="column.dataIndex === 'type'">
              <NTag>{{ document.type }}</NTag>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <NTag :color="document.status === '已完成' ? 'green' : document.status === '草稿' ? 'default' : 'orange'">
                {{ document.status }}
              </NTag>
            </template>
            <template v-else-if="column.dataIndex === 'members'">
              <div class="members">
                <NTag v-for="member in document.members" :key="member.name" :color="member.owner ? 'blue' : undefined">
                  {{ member.name }} · {{ member.role }}
                </NTag>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'issues'">
              <NTag :color="document.issues ? 'red' : 'default'">{{ document.issues }} 项</NTag>
            </template>
            <template v-else-if="column.dataIndex === 'action'">
              <div class="action-buttons">
                <NButton size="small" type="text" style="color: #447dff" :href="editorHref(document.id)">打开</NButton>
                <NButton size="small" type="text" style="color: #447dff" @click="openEditDrawer(document)">编辑</NButton>
                <NButton size="small" type="text" style="color: #447dff" @click="duplicateDocument(document)">复制</NButton>
                <NButton size="small" type="text" danger @click="confirmDeleteDocument(document)">删除</NButton>
              </div>
            </template>
            <template v-else>{{ document[column.dataIndex as keyof DocumentItem] }}</template>
          </template>
        </NTable>
      </div>
      <div class="table-pagination">
        <NPagination
          :current="pagination.current"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          :show-size-changer="pagination.showSizeChanger"
          :show-quick-jumper="pagination.showQuickJumper"
          :show-total="pagination.showTotal"
          :page-size-options="pagination.pageSizeOptions"
          @change="pagination.onChange"
        />
      </div>
      </div>
    </div>

    <NDrawer
      get-container="body"
      v-model:visible="isFormDrawerOpen"
      :title="drawerTitle"
      placement="right"
      :width="560"
      :footer-style="{ textAlign: 'right' }"
      @close="closeFormDrawer"
    >
      <NForm :model="createForm" layout="vertical" @submit.prevent="submitDocumentForm">
        <div v-if="!isEditing" class="mode-grid" role="radiogroup" aria-label="创建方式">
          <NButton
            class="mode-card"
            :class="{ active: createMode === 'new' }"
            @click="createMode = 'new'"
          >
            <strong>新建文档</strong>
            <span>从任务和参考资料开始编写</span>
          </NButton>
          <NButton
            class="mode-card"
            :class="{ active: createMode === 'import' }"
            @click="createMode = 'import'"
          >
            <strong>导入已有文档</strong>
            <span>从现有内容开始持续优化</span>
          </NButton>
        </div>

        <NFormItem v-if="!isEditing && createMode === 'import'" label="导入文件" required>
          <div class="reference-block">
            <NUpload :show-upload-list="false" accept=".docx,.doc,.pdf" :before-upload="beforeImportUpload" :max-count="1">
              <NButton>选择文件</NButton>
            </NUpload>
            <NTag v-if="importFileName" closable @close="importFileName = ''">{{ importFileName }}</NTag>
            <span v-else class="reference-empty">支持 docx 等现有文档，当前为前端模拟导入</span>
          </div>
        </NFormItem>

        <NFormItem label="文档名称" name="name" required>
          <NInput ref="documentNameInput" v-model:value="createForm.name" placeholder="请输入文档名称" />
        </NFormItem>
        <NFormItem label="项目 / 型号 / 批次" name="project">
          <NInput v-model:value="createForm.project" placeholder="请输入项目、型号或批次" />
        </NFormItem>
        <NFormItem label="编写目标" name="goal">
          <NTextarea v-model:value="createForm.goal" :rows="4" placeholder="请说明编写目标" />
        </NFormItem>
        <NFormItem label="文档类型" name="type">
          <NSelect v-model:value="createForm.type" :options="documentTypeOptions.filter((item) => item.value !== 'all')" />
        </NFormItem>
        <NFormItem v-if="isEditing" label="状态" name="status">
          <NSelect v-model:value="createForm.status" :options="progressOptions.filter((item) => item.value !== 'all')" />
        </NFormItem>
        <NFormItem label="专业" name="major">
          <NSelect v-model:value="createForm.major" :options="majorOptions.filter((item) => item.value !== 'all')" />
        </NFormItem>
        <NFormItem label="参考资料">
          <div class="reference-block">
            <NUpload :show-upload-list="false" :before-upload="beforeReferenceUpload" multiple>
              <NButton>添加资料</NButton>
            </NUpload>
            <div v-if="referenceFiles.length" class="reference-tags">
              <NTag
                v-for="fileName in referenceFiles"
                :key="fileName"
                closable
                @close="removeReferenceFile(fileName)"
              >
                {{ fileName }}
              </NTag>
            </div>
            <span v-else class="reference-empty">可关联标准规范、历史方案、质量报告等</span>
          </div>
        </NFormItem>
      </NForm>
      <template #footer>
        <NButton class="drawer-cancel-btn" @click="closeFormDrawer">取消</NButton>
        <NButton type="primary" :loading="saving" @click="submitDocumentForm">
          {{ submitLabel }}
        </NButton>
      </template>
    </NDrawer>
  </div>
</template>

<style scoped>
.documents-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 8px;
  overflow: hidden;
  box-sizing: border-box;
  font-family: "Microsoft YaHei", "微软雅黑", -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
  background-color: #d8e0f4;
}

.page-top {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 12px;
}

.page-main {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.tab-blocks {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.tab-block {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 108px;
  align-items: flex-start;
  flex-direction: column;
  padding: 16px 18px 14px;
  border: 1px solid transparent;
  border-radius: 10px;
  appearance: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  box-shadow: 0 2px 8px -2px rgb(30 47 85 / 12%);
}

.tab-block strong {
  z-index: 1;
  font-size: 16px;
  line-height: 1.4;
}

.tab-block p {
  z-index: 1;
  max-width: 78%;
  margin: 6px 0 0;
  color: #4b5563;
  font-size: 12px;
  line-height: 1.5;
}

.tab-block > span {
  z-index: 1;
  margin-top: auto;
  padding-top: 10px;
  font-size: 13px;
  font-weight: 600;
}

.tab-block-mark {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: min(72px, 38%);
  height: min(72px, calc(100% - 16px));
  pointer-events: none;
  fill: currentColor;
  opacity: .18;
}

.tab-block--blue {
  color: #2f5cd6;
  background: #e7efff;
}

.tab-block--rose {
  color: #c23a3a;
  background: #fdeaea;
}

.tab-block--green {
  color: #1a8f5c;
  background: #e5f6ec;
}

.tab-block--gold {
  color: #b07a12;
  background: #fff3d4;
}

.tab-block.active {
  border-color: color-mix(in srgb, currentColor 55%, transparent);
  box-shadow:
    0 4px 14px color-mix(in srgb, currentColor 22%, transparent),
    0 1px 4px rgb(30 47 85 / 8%);
}

.search-area {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 8px -2px rgb(30 47 85 / 15%);
}

.search-area-left {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.search-area-right {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.table-area {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 8px -2px rgb(30 47 85 / 15%);
}

.table-content {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.table-content :deep(.nl-table-wrapper),
.table-content :deep(.ant-table-wrapper) {
  display: flex;
  flex: 1;
  min-height: 0;
  height: 100%;
  flex-direction: column;
}

.table-content :deep(.nl-spin-nested-loading),
.table-content :deep(.ant-spin-nested-loading) {
  height: 100%;
}

.table-content :deep(.nl-spin-container),
.table-content :deep(.ant-spin-container) {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.table-content :deep(.nl-table),
.table-content :deep(.ant-table) {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.table-content :deep(.nl-table-container),
.table-content :deep(.ant-table-container) {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.table-content :deep(.nl-table-body),
.table-content :deep(.ant-table-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto !important;
}

.table-content :deep(.nl-table-header .nl-table-cell-scrollbar),
.table-content :deep(.ant-table-header .ant-table-cell-scrollbar) {
  right: 0 !important;
  width: var(--table-scrollbar-width, 0px) !important;
  min-width: var(--table-scrollbar-width, 0px) !important;
  max-width: var(--table-scrollbar-width, 0px) !important;
}

.table-content :deep(.nl-table-header col:last-child),
.table-content :deep(.ant-table-header col:last-child) {
  width: var(--table-scrollbar-width, 0px) !important;
}

.table-content:not(.has-y-scroll) :deep(.nl-table-header .nl-table-cell-scrollbar),
.table-content:not(.has-y-scroll) :deep(.ant-table-header .ant-table-cell-scrollbar) {
  display: none !important;
}

.table-content :deep(.nl-table-header .nl-table-cell-fix-right-first),
.table-content :deep(.ant-table-header .ant-table-cell-fix-right-first) {
  right: var(--table-scrollbar-width, 0px) !important;
}

.table-content :deep(.nl-table-body .nl-table-cell-fix-right),
.table-content :deep(.ant-table-body .ant-table-cell-fix-right) {
  right: 0 !important;
}

.table-content :deep(.nl-table-placeholder),
.table-content :deep(.nl-table-placeholder > .nl-table-cell) {
  height: 100%;
}

.table-pagination {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: keep-all;
  white-space: nowrap;
}

.members {
  display: flex;
  overflow: hidden;
  align-items: center;
  gap: 6px;
}

.members :deep(.nl-tag) {
  margin: 0;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.mode-card {
  display: flex;
  min-height: 64px;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 10px 12px;
  text-align: left;
  height: auto;
}

.mode-card:deep(> span) {
  display: contents;
}

.mode-card.active {
  border-color: #447dff;
  color: #447dff;
  background: #f0f7ff;
}

.mode-card strong {
  font-size: 14px;
}

.mode-card span {
  color: #667286;
  font-size: 12px;
}

.reference-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reference-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.reference-empty {
  color: rgb(0 0 0 / 45%);
  font-size: 12px;
}

.drawer-cancel-btn {
  margin-right: 8px;
}

@media (max-width: 900px) {
  .tab-blocks {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-area {
    align-items: stretch;
    flex-direction: column;
  }

  .search-area-right {
    justify-content: flex-end;
  }

  .mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
