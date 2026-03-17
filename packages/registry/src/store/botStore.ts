import { db } from './db.js'
import type { RICCertificate } from '../models/certificate.js'

// ── Row ↔ Certificate conversion ─────────────────────────

function rowToCert(row: any): RICCertificate {
  return {
    ric_version: '1.0',
    id: row.id,
    created_at: row.created_at,
    grade: row.grade,
    grade_updated_at: row.grade_updated_at,
    public_key: row.public_key,
    signature: row.signature,
    developer: {
      name: row.dev_name,
      email: row.dev_email,
      org: row.dev_org ?? undefined,
      website: row.dev_website ?? undefined,
      verified: row.dev_verified === 1,
    },
    bot: {
      name: row.bot_name,
      version: row.bot_version,
      purpose: row.bot_purpose,
      capabilities: JSON.parse(row.bot_capabilities),
      user_agent: row.bot_user_agent,
    },
  }
}

const stmts = {
  insert: db.prepare(`
    INSERT INTO bots (
      id, created_at, grade, grade_updated_at, public_key, signature,
      dev_name, dev_email, dev_org, dev_website, dev_verified,
      bot_name, bot_version, bot_purpose, bot_capabilities, bot_user_agent
    ) VALUES (
      @id, @created_at, @grade, @grade_updated_at, @public_key, @signature,
      @dev_name, @dev_email, @dev_org, @dev_website, @dev_verified,
      @bot_name, @bot_version, @bot_purpose, @bot_capabilities, @bot_user_agent
    )
  `),

  findById: db.prepare(`SELECT * FROM bots WHERE id = ?`),

  findByPublicKey: db.prepare(`SELECT id FROM bots WHERE public_key = ?`),

  findByEmailAndBotName: db.prepare(`
    SELECT id FROM bots WHERE dev_email = ? AND bot_name = ?
  `),

  listSummary: db.prepare(`
    SELECT id, bot_name, bot_purpose, grade, dev_name, dev_org, created_at
    FROM bots ORDER BY created_at DESC
  `),

  updateGrade: db.prepare(`
    UPDATE bots SET grade = @grade, grade_updated_at = @grade_updated_at WHERE id = @id
  `),

  countRecentReports: db.prepare(`
    SELECT COUNT(*) as cnt FROM audit_log
    WHERE ric_id = ? AND event = 'violation_report'
    AND timestamp > datetime('now', '-24 hours')
  `),
}

export const botStore = {
  /** Returns existing RIC ID if the public key is already registered. */
  findByPublicKey(publicKey: string): string | null {
    const row = stmts.findByPublicKey.get(publicKey) as { id: string } | undefined
    return row?.id ?? null
  },

  /** Returns existing RIC ID if (email + botName) combo already exists. */
  findByEmailAndBotName(email: string, botName: string): string | null {
    const row = stmts.findByEmailAndBotName.get(email, botName) as { id: string } | undefined
    return row?.id ?? null
  },

  insert(cert: RICCertificate): void {
    stmts.insert.run({
      id: cert.id,
      created_at: cert.created_at,
      grade: cert.grade,
      grade_updated_at: cert.grade_updated_at,
      public_key: cert.public_key,
      signature: cert.signature,
      dev_name: cert.developer.name,
      dev_email: cert.developer.email,
      dev_org: cert.developer.org ?? null,
      dev_website: cert.developer.website ?? null,
      dev_verified: cert.developer.verified ? 1 : 0,
      bot_name: cert.bot.name,
      bot_version: cert.bot.version,
      bot_purpose: cert.bot.purpose,
      bot_capabilities: JSON.stringify(cert.bot.capabilities),
      bot_user_agent: cert.bot.user_agent,
    })
  },

  findById(id: string): RICCertificate | null {
    const row = stmts.findById.get(id)
    return row ? rowToCert(row) : null
  },

  listSummary(): Array<{
    id: string; name: string; purpose: string; grade: string;
    developer_org: string; created_at: string;
  }> {
    return (stmts.listSummary.all() as any[]).map((row) => ({
      id: row.id,
      name: row.bot_name,
      purpose: row.bot_purpose,
      grade: row.grade,
      developer_org: row.dev_org || row.dev_name,
      created_at: row.created_at,
    }))
  },

  updateGrade(id: string, grade: string): void {
    stmts.updateGrade.run({ id, grade, grade_updated_at: new Date().toISOString() })
  },

  countRecentReports(id: string): number {
    const row = stmts.countRecentReports.get(id) as { cnt: number }
    return row.cnt
  },
}
