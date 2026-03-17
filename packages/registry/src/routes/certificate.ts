import type { FastifyPluginAsync } from 'fastify'
import { createReadStream, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { botStore } from '../store/botStore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = resolve(__dirname, '../../assets')

/**
 * Certificate issuance logic:
 *   - Bot has 'read_images' capability → visual PNG certificate (luxury card style)
 *   - Otherwise                        → code PNG certificate  (terminal JSON style)
 */
function selectCertificateFile(capabilities: string[]): {
  file: string
  type: 'visual' | 'code'
} {
  if (capabilities.includes('read_images')) {
    return { file: 'certificate-visual.png', type: 'visual' }
  }
  return { file: 'certificate-code.png', type: 'code' }
}

export const certificateRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/bots/:id/certificate
   *
   * Returns the appropriate award certificate PNG for this bot.
   * - read_images capability  → luxury visual certificate
   * - text-only bots          → terminal code certificate
   *
   * Query params:
   *   ?format=image   force PNG stream (default)
   *   ?format=json    return certificate metadata as JSON
   */
  fastify.get('/:id/certificate', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { format } = request.query as { format?: string }

    const cert = botStore.findById(id)
    if (!cert) {
      return reply.status(404).send({ error: 'Bot not found', id })
    }

    const { file, type } = selectCertificateFile(cert.bot.capabilities)
    const filePath = resolve(ASSETS_DIR, file)

    // JSON metadata mode
    if (format === 'json') {
      return reply.send({
        ric_id: cert.id,
        bot_name: cert.bot.name,
        developer: cert.developer.email,
        grade: cert.grade,
        certificate_type: type,
        certificate_url: `/v1/bots/${id}/certificate`,
        issued_at: cert.created_at,
        signed_by: 'LUMIOI Instructor',
      })
    }

    // PNG stream mode (default)
    try {
      const stat = statSync(filePath)
      reply.header('Content-Type', 'image/png')
      reply.header('Content-Length', stat.size)
      reply.header('Content-Disposition', `inline; filename="${cert.bot.name}-ric-certificate.png"`)
      reply.header('Cache-Control', 'public, max-age=86400')
      return reply.send(createReadStream(filePath))
    } catch {
      return reply.status(500).send({ error: 'Certificate asset not found on server' })
    }
  })
}
