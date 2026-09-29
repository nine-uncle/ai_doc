import type { Annotation } from '@/types/annotation'

export const MOCK_ANNOTATIONS: Record<string, Annotation> = {
  'ann-1': {
    id: 'ann-1',
    quote: '用户在阅读长文档时难以快速定位重点',
    author: 'AI 审阅',
    content: '建议补充用户调研数据，说明该痛点在具体业务场景中的发生频率与影响范围。',
    createdAt: '2026-08-18 09:42',
  },
  'ann-2': {
    id: 'ann-2',
    quote: 'Vue 3 + Tiptap 负责文档展示',
    author: 'AI 审阅',
    content: '技术选型合理。后续可考虑补充协同编辑与版本对比能力的技术预案。',
    createdAt: '2026-08-18 09:45',
  },
  'ann-3': {
    id: 'ann-3',
    quote: '后续可迭代编辑、对话、上传等高级功能',
    author: 'AI 审阅',
    content: '迭代路线清晰，建议按「批注联动 → 对话助手 → 文档上传」顺序推进。',
    createdAt: '2026-08-18 09:48',
  },
}

export function getAnnotation(id: string): Annotation | null {
  return MOCK_ANNOTATIONS[id] ?? null
}
