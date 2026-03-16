import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import * as ed from '@noble/ed25519'
import { RICCertificateSchema } from '../models/certificate'

const RegisterBodySchema = z.object({
  developer: z.object({
    name: z.string(),
    email: z.string().email(),
    org: z.string().optional(),
    website: z.string().url().optional(),
  }),
  bot: z.object({
    name: z.string(),
    version: z.string(),
    purpose: z.string().min(10).max(500),
    capabilities: z.array(z.string()),
    user_agent: z.string(),
  }),
  public_key: z.string().startsWith('ed25519:'),
})

// In-memory store for demo — replace with DB in production
const registry = new Map<string, any>()

export const registrationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /v1/bots/register
   * Register a new bot and receive its RIC certificate
   */
  fastify.post('/register', async (request, reply) => {
    const body = RegisterBodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid request', details: body.error.flatten() })
    }

    const { developer, bot, public_key } = body.data
    const id = `ric_${nanoid(16)}`
    const now = new Date().toISOString()

    const certificate = {
      ric_version: '1.0',
      id,
      created_at: now,
      developer: { ...developer, verified: false },
      bot,
      grade: 'unknown',
      grade_updated_at: now,
      public_key,
      // Registry signs the certificate with its own private key in production
      signature: `registry_sig_${nanoid(32)}`,
    }

    registry.set(id, certificate)

    fastify.log.info(`New bot registered: ${id} (${bot.name} by ${developer.email})`)

    return reply.status(201).send({
      certificate,
      message: 'Bot registered successfully. Grade: UNKNOWN — weekly review pending.',
      docs: 'https://github.com/your-org/robot-id-card/wiki/getting-started',
    })
  })

  /**
   * GET /v1/bots/:id
   * Fetch a bot's current certificate and grade
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const cert = registry.get(id)

    if (!cert) {
      return reply.status(404).send({ error: 'Bot not found', id })
    }

    return reply.send(cert)
  })

  /**
   * GET /v1/bots
   * List all registered bots (public summary only)
   */
  fastify.get('/', async () => {
    const bots = [...registry.values()].map(({ id, bot, grade, developer, created_at }) => ({
      id,
      name: bot.name,
      purpose: bot.purpose,
      grade,
      developer_org: developer.org || developer.name,
      created_at,
    }))
    return { total: bots.length, bots }
  })
}
