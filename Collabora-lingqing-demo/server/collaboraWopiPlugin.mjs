import { randomBytes, randomUUID } from 'node:crypto'
import { createDocxFromTemplate } from './createDocx.mjs'

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const AI_STREAM_DEMO_TEXT = '这是ai流式返回的文字，查看效果。'

function normalizeOrigin(value) {
  return value?.trim().replace(/\/$/, '') || ''
}

function requestOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const protocol = forwardedProto || (req.socket.encrypted ? 'https' : 'http')
  return `${protocol}://${req.headers.host}`
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function safeFileName(input) {
  const decoded = String(input || 'document.docx').replace(/[\\/\0]/g, '_').trim()
  const name = decoded || 'document.docx'
  return /\.docx$/i.test(name) ? name : `${name}.docx`
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []

    req.on('data', (chunk) => {
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function accessTokenFrom(req, url) {
  const queryToken = url.searchParams.get('access_token')
  if (queryToken) return queryToken

  const authorization = String(req.headers.authorization || '')
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
}

function downloadDisposition(fileName) {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

function streamAiDemo(res, text = AI_STREAM_DEMO_TEXT) {
  const completedText = text || AI_STREAM_DEMO_TEXT
  const characters = Array.from(completedText)
  let index = 0

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  res.write(': connected\n\n')

  const timer = setInterval(() => {
    if (index < characters.length) {
      res.write(`event: delta\ndata: ${JSON.stringify({ delta: characters[index] })}\n\n`)
      index += 1
      return
    }

    clearInterval(timer)
    res.write(`event: done\ndata: ${JSON.stringify({ text: completedText })}\n\n`)
    res.end()
  }, 140)

  res.on('close', () => clearInterval(timer))
}

export function collaboraWopiPlugin(options = {}) {
  const files = new Map()
  const configuredPublicOrigin = normalizeOrigin(options.publicWopiOrigin)

  function createFile(name, buffer, postMessageOrigin) {
    const record = {
      id: randomUUID(),
      token: randomBytes(32).toString('hex'),
      name: safeFileName(name),
      buffer,
      version: 1,
      updatedAt: new Date().toISOString(),
      postMessageOrigin,
    }
    files.set(record.id, record)
    return record
  }

  function getAuthorizedFile(req, res, url, id) {
    const file = files.get(id)
    if (!file) {
      json(res, 404, { error: '文件不存在或开发服务已重启' })
      return null
    }
    if (accessTokenFrom(req, url) !== file.token) {
      json(res, 401, { error: 'WOPI access token 无效' })
      return null
    }
    return file
  }

  function launchInfo(req, file) {
    const publicOrigin = configuredPublicOrigin || requestOrigin(req)
    return {
      fileId: file.id,
      fileName: file.name,
      accessToken: file.token,
      wopiSrc: `${publicOrigin}/wopi/files/${encodeURIComponent(file.id)}`,
      downloadUrl: `/api/collabora/files/${encodeURIComponent(file.id)}/download?access_token=${file.token}`,
      version: file.version,
      updatedAt: file.updatedAt,
    }
  }

  async function middleware(req, res, next) {
    const url = new URL(req.url || '/', requestOrigin(req))
    const pathname = url.pathname

    try {
      if (req.method === 'GET' && pathname === '/api/ai/stream-demo') {
        const customText = url.searchParams.get('text')?.trim()
        return streamAiDemo(res, customText || AI_STREAM_DEMO_TEXT)
      }

      if (req.method === 'POST' && pathname === '/api/collabora/files/from-template') {
        const raw = await readBody(req)
        let payload = {}
        try {
          payload = raw.length ? JSON.parse(raw.toString('utf8')) : {}
        } catch {
          return json(res, 400, { error: '请求体不是合法 JSON' })
        }

        const fileName = safeFileName(payload.fileName || payload.title || 'document.docx')
        const buffer = createDocxFromTemplate(payload)
        if (buffer.length === 0) return json(res, 400, { error: '无法生成文档' })

        const browserOrigin = normalizeOrigin(req.headers.origin) || requestOrigin(req)
        const file = createFile(fileName, buffer, browserOrigin)
        return json(res, 201, launchInfo(req, file))
      }

      if (req.method === 'POST' && pathname === '/api/collabora/files') {
        const body = await readBody(req)
        if (body.length === 0) return json(res, 400, { error: '上传文件为空' })

        const rawName = url.searchParams.get('name') || 'document.docx'
        const browserOrigin = normalizeOrigin(req.headers.origin) || requestOrigin(req)
        const file = createFile(rawName, body, browserOrigin)
        return json(res, 201, launchInfo(req, file))
      }

      const apiMatch = pathname.match(/^\/api\/collabora\/files\/([^/]+)\/(status|download)$/)
      if (apiMatch && req.method === 'GET') {
        const id = decodeURIComponent(apiMatch[1])
        const file = getAuthorizedFile(req, res, url, id)
        if (!file) return

        if (apiMatch[2] === 'status') return json(res, 200, launchInfo(req, file))

        res.statusCode = 200
        res.setHeader('Content-Type', DOCX_CONTENT_TYPE)
        res.setHeader('Content-Length', String(file.buffer.length))
        res.setHeader('Content-Disposition', downloadDisposition(file.name))
        return res.end(file.buffer)
      }

      const contentsMatch = pathname.match(/^\/wopi\/files\/([^/]+)\/contents$/)
      if (contentsMatch) {
        const id = decodeURIComponent(contentsMatch[1])
        const file = getAuthorizedFile(req, res, url, id)
        if (!file) return

        if (req.method === 'GET') {
          res.statusCode = 200
          res.setHeader('Content-Type', DOCX_CONTENT_TYPE)
          res.setHeader('Content-Length', String(file.buffer.length))
          res.setHeader('X-WOPI-ItemVersion', String(file.version))
          return res.end(file.buffer)
        }

        if (req.method === 'POST' || req.method === 'PUT') {
          file.buffer = await readBody(req)
          file.version += 1
          file.updatedAt = new Date().toISOString()
          return json(res, 200, {
            LastModifiedTime: file.updatedAt,
            Version: String(file.version),
          })
        }

        res.statusCode = 405
        res.setHeader('Allow', 'GET, POST, PUT')
        return res.end()
      }

      const infoMatch = pathname.match(/^\/wopi\/files\/([^/]+)$/)
      if (infoMatch && req.method === 'GET') {
        const id = decodeURIComponent(infoMatch[1])
        const file = getAuthorizedFile(req, res, url, id)
        if (!file) return

        return json(res, 200, {
          BaseFileName: file.name,
          Size: file.buffer.length,
          Version: String(file.version),
          OwnerId: 'lingqing-demo',
          UserId: 'lingqing-user',
          UserFriendlyName: '灵清用户',
          UserCanWrite: true,
          UserCanNotWriteRelative: true,
          SupportsUpdate: true,
          SupportsLocks: false,
          LastModifiedTime: file.updatedAt,
          PostMessageOrigin: file.postMessageOrigin,
        })
      }
    } catch (error) {
      if (!res.headersSent) {
        json(res, error?.statusCode || 500, {
          error: error instanceof Error ? error.message : 'WOPI 服务异常',
        })
      }
      return
    }

    next()
  }

  return {
    name: 'collabora-wopi-host',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
