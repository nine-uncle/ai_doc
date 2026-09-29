import type { DocumentSection, FlatTocNode, StreamEvent } from '@/types/document'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomDelay(min: number, max: number) {
  return delay(min + Math.floor(Math.random() * (max - min + 1)))
}

function headingTag(level: 1 | 2 | 3, id: string, text: string) {
  return `<h${level} id="${id}">${text}</h${level}>`
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[。！？；.!?])/u)
    .map((part) => part.trim())
    .filter(Boolean)
}

async function* streamTocNodes(
  nodes: FlatTocNode[],
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const total = nodes.length

  for (let index = 0; index < nodes.length; index += 1) {
    if (signal?.aborted) return

    const depth = nodes[index].parentId ? (nodes[index].id.match(/-/g)?.length ?? 0) : 0
    const waitMs = depth === 0 ? 220 : depth === 1 ? 160 : 120

    await delay(waitMs)
    yield {
      type: 'status',
      message: `正在生成目录结构（${index + 1}/${total}）…`,
    }
    yield { type: 'toc', node: nodes[index] }
  }
}

async function* streamParagraph(para: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  const sentences = splitSentences(para)

  if (sentences.length <= 1) {
    if (signal?.aborted) return
    await randomDelay(90, 150)
    yield { type: 'html', chunk: `<p>${para}</p>` }
    return
  }

  for (const sentence of sentences) {
    if (signal?.aborted) return
    await randomDelay(70, 120)
    yield { type: 'html', chunk: `<p>${sentence}</p>` }
  }
}

async function* streamListItems(items: string[], signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  if (signal?.aborted) return
  await randomDelay(80, 120)
  yield { type: 'html', chunk: '<ul>' }

  for (const item of items) {
    if (signal?.aborted) return
    await randomDelay(100, 160)
    yield { type: 'html', chunk: `<li>${item}</li>` }
  }

  if (signal?.aborted) return
  await randomDelay(60, 100)
  yield { type: 'html', chunk: '</ul>' }
}

async function* streamHtmlBlock(block: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  if (signal?.aborted) return
  await randomDelay(100, 160)
  yield { type: 'html', chunk: block }
}

async function* streamSections(
  sections: DocumentSection[],
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const totalSections = sections.length

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex]
    if (signal?.aborted) return

    if (section.heading) {
      yield {
        type: 'status',
        message: `正在写入「${section.heading.text}」（${sectionIndex + 1}/${totalSections}）…`,
      }
      await randomDelay(140, 220)
      yield {
        type: 'html',
        chunk: headingTag(section.heading.level, section.heading.id, section.heading.text),
      }
    }

    if (section.paragraphs) {
      for (const paragraph of section.paragraphs) {
        yield* streamParagraph(paragraph, signal)
      }
    }

    if (section.listItems) {
      yield* streamListItems(section.listItems, signal)
    }

    if (section.htmlBlocks) {
      for (const block of section.htmlBlocks) {
        yield* streamHtmlBlock(block, signal)
      }
    }
  }
}

export async function* runDocumentStream(
  input: {
    fileName: string
    toc: FlatTocNode[]
    sections: DocumentSection[]
    sourceLabel?: string
  },
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const label = input.sourceLabel ?? input.fileName

  yield { type: 'status', message: `正在解析「${label}」…` }
  await randomDelay(400, 600)

  if (input.toc.length > 0) {
    yield { type: 'phase', phase: 'toc' }
    yield { type: 'status', message: '识别到多级标题，开始构建目录…' }
    yield* streamTocNodes(input.toc, signal)
  } else {
    yield { type: 'phase', phase: 'toc' }
    yield { type: 'status', message: '未识别到标题样式，跳过目录生成…' }
    await delay(300)
  }

  yield { type: 'status', message: '目录阶段完成，开始流式写入正文…' }
  await randomDelay(300, 450)
  yield { type: 'phase', phase: 'content' }

  yield* streamSections(input.sections, signal)

  yield { type: 'phase', phase: 'done' }
  yield { type: 'done' }
  yield {
    type: 'status',
    message: `「${label}」处理完成，可点击目录验证锚点跳转；也可使用「原生 DOCX」对比展示差异`,
  }
}
