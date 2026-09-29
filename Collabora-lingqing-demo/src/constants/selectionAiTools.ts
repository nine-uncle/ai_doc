export const SELECTION_AI_TOOLS = [
  { id: 'aidoc-rewrite', label: '改写' },
  { id: 'aidoc-expand', label: '扩写' },
  { id: 'aidoc-condense', label: '缩写' },
  { id: 'aidoc-polish', label: '润色' },
  { id: 'aidoc-summary', label: '提炼摘要' },
  { id: 'aidoc-terms', label: '术语规范' },
  { id: 'aidoc-illustration', label: '生成配图' },
] as const

export type SelectionAiToolId = (typeof SELECTION_AI_TOOLS)[number]['id']

export function isSelectionAiToolId(value: string): value is SelectionAiToolId {
  return SELECTION_AI_TOOLS.some((tool) => tool.id === value)
}

export function selectionAiIconUrl(origin: string, id: SelectionAiToolId) {
  return `${origin}/aidoc-toolbar/${id}.svg?v=3`
}
