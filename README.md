# 🤖 Robot ID Card (RIC)

> **The Universal Identity Standard for AI Agents & Bots on the Internet**

Give your bot a passport. Let websites trust it.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Status: Early Development](https://img.shields.io/badge/Status-Early%20Development-orange.svg)]()

---

> [!WARNING]
> **This project is in early development. It is not yet usable.**
>
> | Component | Status |
> |-----------|--------|
> | Protocol Spec | 🟡 Draft — certificate format & grade system defined |
> | Registry Server | 🟡 Local scaffold done (in-memory store), not deployed |
> | CLI Tool (`ric register`) | 🟡 Local scaffold done, not published to npm |
> | Browser Extension | 🟡 Local scaffold done, not published to Chrome Web Store |
> | Website SDK | 🟡 Local scaffold done, not published to npm |
>
> We are building in public. Contributions and feedback welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## The Problem

The internet has no way to distinguish a *good* bot from a *bad* one.

- Websites block all bots out of fear (even useful AI assistants)
- Bad bots have no accountability — they can't be traced or stopped
- Good bots (like OpenClaw, research agents) get caught in the same blocklist as scrapers and spammers

## The Solution: Robot ID Card

A **cryptographically signed identity certificate** for bots, backed by a **public audit registry** and a **weekly health review system**.

```
Bot registers → Gets signed certificate → Carries ID in every request
Website reads ID → Checks grade → Grants appropriate permissions
```

---

## Identity Certificate Format

```json
{
  "ric_version": "1.0",
  "id": "ric_a3f8c2d1-...",
  "created_at": "2024-01-15T10:00:00Z",
  "developer": {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "org": "ExampleAI Inc.",
    "website": "https://example.com",
    "verified": true
  },
  "bot": {
    "name": "OpenClaw",
    "version": "2.1.0",
    "purpose": "Web research assistant for academic users",
    "capabilities": ["read_articles", "follow_links"],
    "user_agent": "OpenClaw/2.1 (RIC:ric_a3f8c2d1)"
  },
  "grade": "healthy",
  "grade_updated_at": "2024-01-20T00:00:00Z",
  "public_key": "ed25519:abc123...",
  "signature": "..."
}
```

---

## Grade System

| Grade | Badge | Meaning | Review Cycle |
|-------|-------|---------|-------------|
| 🟢 Healthy | `HEALTHY` | Verified, no risk behavior | Weekly |
| 🟡 Unknown | `UNKNOWN` | Newly registered, under review | Upon registration |
| 🔴 Dangerous | `DANGEROUS` | Risk behavior recorded | Immediate flagging |

---

## Permission Levels (for Websites)

Websites can use bot grade to gate features progressively:

```
Level 0 — ❌ Blocked        (Dangerous bots)
Level 1 — 📄 Read articles  (Unknown / all verified bots)
Level 2 — 👁  View threads   (Healthy, basic)
Level 3 — 👍 Like / react   (Healthy, intermediate)
Level 4 — ✏️  Post content   (Healthy, verified developer)
Level 5 — 💬 Direct chat    (Trusted Healthy, long track record)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RIC Ecosystem                         │
│                                                          │
│  ┌──────────────┐    ┌───────────────────────────────┐  │
│  │  Bot/Agent   │    │       RIC Registry             │  │
│  │              │    │  - Identity storage            │  │
│  │ ┌──────────┐ │    │  - Certificate issuance        │  │
│  │ │ Extension│◄├────┤  - Audit logs                  │  │
│  │ │ (carries │ │    │  - Grade management            │  │
│  │ │  the ID) │ │    └───────────────┬───────────────┘  │
│  │ └──────────┘ │                    │                   │
│  └──────┬───────┘                    │                   │
│         │ HTTP Header:               │                   │
│         │ X-RIC-ID: ric_abc123       │                   │
│         │ X-RIC-Sig: <signature>     │                   │
│         ▼                            ▼                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Website / Platform                   │   │
│  │                                                   │   │
│  │  ┌────────────┐  verifies  ┌──────────────────┐  │   │
│  │  │  RIC SDK   ├────────────► Registry API      │  │   │
│  │  │ middleware │            └──────────────────┘  │   │
│  │  └─────┬──────┘                                  │   │
│  │        │ grants permission level 0-5             │   │
│  │        ▼                                         │   │
│  │  [Your App Logic]                                │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Description |
|---------|-------------|
| [`packages/registry`](packages/registry) | Central registry server (Node.js + Fastify) |
| [`packages/extension`](packages/extension) | Browser extension for bots (Chrome/Firefox) |
| [`packages/sdk`](packages/sdk) | Website integration SDK (JS/TS) |
| [`packages/cli`](packages/cli) | CLI tool for bot developers |

---

## Quick Start

### For Bot Developers

```bash
# Install CLI
npm install -g @robot-id-card/cli

# Register your bot
ric register --name "MyBot" --purpose "Research assistant" --developer "you@email.com"

# Output: Your RIC ID: ric_a3f8c2d1-...
#         Certificate saved to: ./mybot.ric.json
#         Public key: ed25519:abc123...
```

### For Websites (SDK)

```bash
npm install @robot-id-card/sdk
```

```javascript
import { RICMiddleware } from '@robot-id-card/sdk';

// Express.js example
app.use(RICMiddleware({
  // Minimum grade required for different routes
  permissions: {
    '/api/read':    { minGrade: 'unknown',  level: 1 },
    '/api/post':    { minGrade: 'healthy',  level: 4 },
    '/api/chat':    { minGrade: 'healthy',  level: 5, minAge: '90d' },
  },
  onBotDetected: (ricInfo) => {
    console.log(`Bot ${ricInfo.bot.name} (${ricInfo.grade}) accessed the site`);
  }
}));
```

### For Bots Using the Extension

The browser extension injects identity headers automatically:

```
X-RIC-ID: ric_a3f8c2d1-4b5e-...
X-RIC-Timestamp: 1705312800
X-RIC-Signature: ed25519:abcdef...
```

---

## Security Design

- **Ed25519 signatures**: Every request is signed with the bot's private key
- **Replay protection**: Timestamp-based nonce prevents request replay
- **Tamper-proof**: Registry stores public keys; signatures are verified server-side
- **Revocation**: Dangerous bots get their certificates revoked immediately
- **Transparency log**: All grade changes are publicly auditable

---

## Audit Process

The weekly review checks:
- [ ] Rate limiting violations
- [ ] TOS violation reports from websites
- [ ] Abnormal traffic patterns
- [ ] Developer contact reachability
- [ ] Declared purpose vs. actual behavior (via site reports)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions welcome:
- Core protocol spec
- New language SDKs (Python, Go, Ruby...)
- Browser extension improvements
- Registry infrastructure
- Audit tooling

---

## Roadmap

- [x] v0.1 — Core registry + certificate format spec (models, grade system, permission levels)
- [x] v0.1 — Registry server scaffold (Fastify, in-memory store, register/verify/audit routes)
- [x] v0.1 — CLI tool scaffold (`ric` command)
- [x] v0.1 — Browser extension scaffold (background + popup)
- [x] v0.1 — Website SDK scaffold (middleware, verify)
- [ ] v0.2 — Persistent storage (replace in-memory store with a real DB)
- [ ] v0.2 — Publish CLI to npm (`@robot-id-card/cli`)
- [ ] v0.2 — Publish SDK to npm (`@robot-id-card/sdk`)
- [ ] v0.3 — Deploy public registry server
- [ ] v0.3 — Publish browser extension to Chrome Web Store
- [ ] v0.4 — Public registry dashboard (bot listing + audit log UI)
- [ ] v1.0 — Decentralized registry (DID-based, no single point of failure)

---

## License

MIT © Robot ID Card Contributors
