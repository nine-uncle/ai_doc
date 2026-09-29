import { MOCK_HTML_SECTIONS, MOCK_TOC } from '@/mock/mockDocumentData'
import type { FlatTocNode, StreamEvent } from '@/types/document'

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
    .split(/(?<=[。！？；])/u)
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

  for (let index = 0; index < sentences.length; index += 1) {
    if (signal?.aborted) return
    await randomDelay(70, 120)
    yield { type: 'html', chunk: `<p>${sentences[index]}</p>` }
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

async function* streamHtmlSections(signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  const totalSections = MOCK_HTML_SECTIONS.length

  for (let sectionIndex = 0; sectionIndex < MOCK_HTML_SECTIONS.length; sectionIndex += 1) {
    const section = MOCK_HTML_SECTIONS[sectionIndex]
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
  }
}

export async function* mockDocumentStream(signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  yield { type: 'status', message: '正在解析上传文档…' }
  await randomDelay(400, 600)

  yield { type: 'phase', phase: 'toc' }
  yield { type: 'status', message: '识别到多级标题，开始构建目录…' }
  yield* streamTocNodes(MOCK_TOC, signal)

  yield { type: 'status', message: '目录生成完成，开始流式写入正文…' }
  await randomDelay(300, 450)
  yield { type: 'phase', phase: 'content' }

  yield* streamHtmlSections(signal)

  yield { type: 'phase', phase: 'done' }
  yield { type: 'done' }
  yield { type: 'status', message: '文档处理完成，可点击目录验证锚点跳转' }
}
