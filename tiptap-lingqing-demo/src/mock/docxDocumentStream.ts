import type { JSONContent } from '@tiptap/core'
import type { StreamEvent } from '@/types/document'
import { assignHeadingIds, getTopLevelNodes } from '@/utils/docxDocument'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomDelay(min: number, max: number) {
  return delay(min + Math.floor(Math.random() * (max - min + 1)))
}

function nodeDelay(node: JSONContent) {
  switch (node.type) {
    case 'heading':
      return randomDelay(120, 200)
    case 'table':
      return randomDelay(180, 280)
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return randomDelay(140, 220)
    default:
      return randomDelay(60, 120)
  }
}

function nodeLabel(node: JSONContent): string {
  if (node.type === 'heading') {
    const level = node.attrs?.level ?? 1
    return `标题 H${level}`
  }

  const labels: Record<string, string> = {
    paragraph: '段落',
    table: '表格',
    bulletList: '无序列表',
    orderedList: '有序列表',
    taskList: '任务列表',
    blockquote: '引用',
    codeBlock: '代码块',
    horizontalRule: '分隔线',
    image: '图片',
  }

  return labels[node.type ?? ''] ?? node.type ?? '内容块'
}

export async function* docxDocumentStream(
  sourceDoc: JSONContent,
  fileName: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const { doc, flatToc } = assignHeadingIds(sourceDoc)
  const nodes = getTopLevelNodes(doc)

  yield { type: 'status', message: `正在解析「${fileName}」…` }
  await randomDelay(300, 500)

  yield { type: 'phase', phase: 'toc' }

  if (flatToc.length === 0) {
    yield { type: 'status', message: '未识别到标题，将直接流式写入正文…' }
  } else {
    yield { type: 'status', message: `识别到 ${flatToc.length} 个标题，开始构建目录…` }

    for (let index = 0; index < flatToc.length; index += 1) {
      if (signal?.aborted) return

      await randomDelay(100, 180)
      yield {
        type: 'status',
        message: `正在生成目录（${index + 1}/${flatToc.length}）…`,
      }
      yield { type: 'toc', node: flatToc[index] }
    }
  }

  yield { type: 'status', message: '目录完成，开始高保真流式写入正文…' }
  await randomDelay(250, 400)
  yield { type: 'phase', phase: 'content' }

  for (let index = 0; index < nodes.length; index += 1) {
    if (signal?.aborted) return

    const node = nodes[index]
    yield {
      type: 'status',
      message: `正在写入${nodeLabel(node)}（${index + 1}/${nodes.length}）…`,
    }
    await nodeDelay(node)
    yield { type: 'json', node }
  }

  yield { type: 'phase', phase: 'done' }
  yield { type: 'done', preparedDoc: doc }
  yield {
    type: 'status',
    message: `「${fileName}」处理完成，可对照 Word 原稿检查样式与结构`,
  }
}
