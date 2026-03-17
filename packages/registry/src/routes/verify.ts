import type { FastifyPluginAsync } from 'fastify'
import * as ed from '@noble/ed25519'
import { getPermissionLevel, PERMISSION_LABELS } from '../models/certificate.js'
import { botStore } from '../store/botStore.js'

export const verifyRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /v1/verify
   * Verify a bot's request signature and return its permission level.
   * Websites call this endpoint to check if an incoming bot request is legitimate.
   */
  fastify.post('/', async (request, reply) => {
    const { ric_id, timestamp, signature, message } = request.body as {
      ric_id: string
      timestamp: number
      signature: string
      message: string
    }

    // Replay protection — reject requests older than 5 minutes
    const age = Date.now() - timestamp
    if (age > 5 * 60 * 1000) {
      return reply.status(401).send({ error: 'Request expired', code: 'EXPIRED' })
    }

    const cert = botStore.findById(ric_id)
    if (!cert) {
      return reply.status(404).send({
        error: 'Unknown RIC ID',
        grade: 'dangerous',
        permission_level: 0,
      })
    }

    // Verify Ed25519 signature
    try {
      const pubKeyHex = cert.public_key.replace('ed25519:', '')
      const msgBytes = new TextEncoder().encode(`${ric_id}:${timestamp}:${message}`)
      const sigBytes = Buffer.from(signature, 'hex')
      const isValid = await ed.verify(sigBytes, msgBytes, Buffer.from(pubKeyHex, 'hex'))

      if (!isValid) {
        return reply.status(401).send({
          error: 'Invalid signature',
          code: 'SIG_MISMATCH',
          grade: 'dangerous',
          permission_level: 0,
        })
      }
    } catch {
      return reply.status(400).send({ error: 'Signature verification failed' })
    }

    const permLevel = getPermissionLevel(cert)

    return reply.send({
      valid: true,
      id: cert.id,
      bot: { name: cert.bot.name, purpose: cert.bot.purpose },
      developer: { name: cert.developer.name, org: cert.developer.org },
      grade: cert.grade,
      permission_level: permLevel,
      permission_label: PERMISSION_LABELS[permLevel],
    })
  })
}
