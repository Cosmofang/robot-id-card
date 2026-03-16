import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { GradeSchema } from '../models/certificate'

const ReportSchema = z.object({
  ric_id: z.string().startsWith('ric_'),
  reporter_domain: z.string(),
  reason: z.enum([
    'spam',
    'scraping_violation',
    'rate_limit_abuse',
    'tos_violation',
    'impersonation',
    'malicious_content',
    'other',
  ]),
  evidence_url: z.string().url().optional(),
  description: z.string().max(1000),
})

// In-memory audit log for demo
const auditLog: Array<{
  id: string
  ric_id: string
  event: string
  old_grade?: string
  new_grade?: string
  reason?: string
  timestamp: string
}> = []

export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /v1/audit/report
   * Website reports bad bot behavior
   */
  fastify.post('/report', async (request, reply) => {
    const body = ReportSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid report', details: body.error.flatten() })
    }

    const { ric_id, reporter_domain, reason, description } = body.data

    const entry = {
      id: `report_${Date.now()}`,
      ric_id,
      event: 'violation_report',
      reason,
      reporter: reporter_domain,
      description,
      timestamp: new Date().toISOString(),
    }

    auditLog.push(entry)
    fastify.log.warn(`Violation report for ${ric_id}: ${reason} from ${reporter_domain}`)

    // Auto-flag as dangerous if 3+ reports in 24h (simplified logic)
    const recentReports = auditLog.filter(
      (e) => e.ric_id === ric_id &&
      Date.now() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000
    )

    if (recentReports.length >= 3) {
      auditLog.push({
        id: `grade_change_${Date.now()}`,
        ric_id,
        event: 'grade_changed',
        old_grade: 'unknown',
        new_grade: 'dangerous',
        reason: 'Auto-flagged: 3+ reports in 24h',
        timestamp: new Date().toISOString(),
      })
    }

    return reply.status(202).send({ message: 'Report submitted for review', report_id: entry.id })
  })

  /**
   * GET /v1/audit/:ric_id
   * Public audit log for a specific bot
   */
  fastify.get('/:ric_id', async (request, reply) => {
    const { ric_id } = request.params as { ric_id: string }
    const log = auditLog.filter((e) => e.ric_id === ric_id)
    return reply.send({ ric_id, total: log.length, events: log })
  })

  /**
   * POST /v1/audit/grade (admin only in production)
   * Manually update a bot's grade after weekly review
   */
  fastify.post('/grade', async (request, reply) => {
    const { ric_id, grade, reason } = request.body as {
      ric_id: string
      grade: string
      reason: string
    }

    const parsed = GradeSchema.safeParse(grade)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid grade' })
    }

    auditLog.push({
      id: `grade_${Date.now()}`,
      ric_id,
      event: 'grade_changed',
      new_grade: grade,
      reason,
      timestamp: new Date().toISOString(),
    })

    return reply.send({ message: `Grade updated to ${grade}`, ric_id })
  })
}
