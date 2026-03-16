#!/usr/bin/env node
/**
 * RIC CLI — Developer tool for managing bot identities
 *
 * Usage:
 *   ric register  — Register a new bot
 *   ric status    — Check your bot's current grade
 *   ric verify    — Verify a bot by RIC ID
 *   ric report    — Report a bad bot
 */

import { Command } from 'commander'
import * as ed from '@noble/ed25519'
import { randomBytes } from 'crypto'
import * as fs from 'fs'
import * as readline from 'readline'

const REGISTRY = process.env.RIC_REGISTRY || 'https://registry.robotidcard.dev'

const program = new Command()
program.name('ric').description('Robot ID Card CLI').version('0.1.0')

// ──────────────────────────────────────────────
// ric register
// ──────────────────────────────────────────────
program
  .command('register')
  .description('Register a new bot and get your RIC certificate')
  .option('--name <name>', 'Bot name')
  .option('--purpose <purpose>', 'What your bot does (min 10 chars)')
  .option('--developer <email>', 'Developer email')
  .option('--org <org>', 'Organization name')
  .option('--out <file>', 'Output certificate file', './bot.ric.json')
  .action(async (opts) => {
    console.log('\n🤖 Robot ID Card — Bot Registration\n')

    // Generate Ed25519 keypair
    const privateKey = randomBytes(32)
    const publicKey = await ed.getPublicKey(privateKey)
    const pubKeyHex = Buffer.from(publicKey).toString('hex')

    const payload = {
      developer: {
        name: opts.developer?.split('@')[0] || 'Bot Developer',
        email: opts.developer || '',
        org: opts.org,
      },
      bot: {
        name: opts.name || 'MyBot',
        version: '1.0.0',
        purpose: opts.purpose || 'General web assistant',
        capabilities: ['read_articles'],
        user_agent: `${opts.name || 'MyBot'}/1.0 (RIC:pending)`,
      },
      public_key: `ed25519:${pubKeyHex}`,
    }

    try {
      const res = await fetch(`${REGISTRY}/v1/bots/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        console.error('Registration failed:', err)
        process.exit(1)
      }

      const { certificate } = await res.json()

      // Save full config (including private key) locally
      const config = {
        ...certificate,
        private_key_hex: privateKey.toString('hex'),  // Keep safe!
      }

      fs.writeFileSync(opts.out, JSON.stringify(config, null, 2))

      console.log(`✅ Bot registered successfully!\n`)
      console.log(`   RIC ID:      ${certificate.id}`)
      console.log(`   Grade:       🟡 UNKNOWN (pending weekly review)`)
      console.log(`   Certificate: ${opts.out}`)
      console.log(`\n⚠️  Keep ${opts.out} safe — it contains your private key!`)
      console.log(`\n📖 Next steps: https://robotidcard.dev/docs/getting-started`)
    } catch (e) {
      console.error('Failed to connect to registry:', e)
      process.exit(1)
    }
  })

// ──────────────────────────────────────────────
// ric status <ric_id>
// ──────────────────────────────────────────────
program
  .command('status [ric_id]')
  .description('Check a bot\'s current grade and certificate')
  .option('--cert <file>', 'Load RIC ID from certificate file')
  .action(async (ricId, opts) => {
    if (!ricId && opts.cert) {
      const cert = JSON.parse(fs.readFileSync(opts.cert, 'utf8'))
      ricId = cert.id
    }
    if (!ricId) {
      console.error('Provide a RIC ID or --cert file')
      process.exit(1)
    }

    const res = await fetch(`${REGISTRY}/v1/bots/${ricId}`)
    if (!res.ok) {
      console.error('Bot not found:', ricId)
      process.exit(1)
    }

    const cert = await res.json()
    const gradeEmoji = { healthy: '🟢', unknown: '🟡', dangerous: '🔴' }[cert.grade as string] || '⚪'

    console.log(`\n${gradeEmoji} ${cert.bot.name}  [${cert.grade.toUpperCase()}]\n`)
    console.log(`   ID:          ${cert.id}`)
    console.log(`   Developer:   ${cert.developer.name} <${cert.developer.email}>`)
    console.log(`   Purpose:     ${cert.bot.purpose}`)
    console.log(`   Created:     ${new Date(cert.created_at).toLocaleDateString()}`)
    console.log(`   Grade since: ${new Date(cert.grade_updated_at).toLocaleDateString()}\n`)
  })

// ──────────────────────────────────────────────
// ric report <ric_id>
// ──────────────────────────────────────────────
program
  .command('report <ric_id>')
  .description('Report a bot for bad behavior')
  .option('--reason <reason>', 'Reason: spam|scraping_violation|rate_limit_abuse|tos_violation')
  .option('--domain <domain>', 'Your domain (reporter)')
  .option('--desc <desc>', 'Description of the incident')
  .action(async (ricId, opts) => {
    const res = await fetch(`${REGISTRY}/v1/audit/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ric_id: ricId,
        reporter_domain: opts.domain || 'unknown',
        reason: opts.reason || 'other',
        description: opts.desc || '',
      }),
    })

    const data = await res.json()
    if (res.ok) {
      console.log(`✅ Report submitted. ID: ${data.report_id}`)
    } else {
      console.error('Report failed:', data)
    }
  })

program.parse()
