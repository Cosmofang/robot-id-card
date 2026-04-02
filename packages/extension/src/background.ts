/**
 * RIC Browser Extension — Background Service Worker (Manifest V3)
 *
 * Injects RIC identity headers into all outgoing HTTPS requests using
 * chrome.declarativeNetRequest (MV3-compatible, replaces the MV2
 * chrome.webRequest blocking approach).
 *
 * Strategy:
 *   - Headers include a timestamp-based Ed25519 signature.
 *   - chrome.alarms fires every REFRESH_MINUTES to regenerate the
 *     signature, keeping it inside the registry's 5-minute replay window.
 */

import * as ed from '@noble/ed25519'

interface RICConfig {
  ricId: string
  privateKeyHex: string
  certificate: object
}

const HEADER_RULE_ID   = 1
const REFRESH_ALARM    = 'ric-header-refresh'
const REFRESH_MINUTES  = 4   // must stay < registry's 5-min replay window

// ── Hex utilities (Buffer is not available in service workers) ─

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return arr
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Config ────────────────────────────────────────────────────

async function getConfig(): Promise<RICConfig | null> {
  const result = await chrome.storage.local.get(['ricId', 'privateKeyHex', 'certificate'])
  if (!result.ricId || !result.privateKeyHex) return null
  return result as RICConfig
}

// ── Header injection ──────────────────────────────────────────

/**
 * Generate a fresh Ed25519 signature and update the declarativeNetRequest
 * dynamic rule so all subsequent requests carry valid, unexpired headers.
 */
async function refreshHeaders(): Promise<void> {
  const config = await getConfig()

  if (!config) {
    // Not configured — clear any existing inject rule
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [HEADER_RULE_ID],
    })
    return
  }

  // Message format matches the registry's verify route:
  //   "<ric_id>:<timestamp>:<message>"  — message is empty for header-level auth
  const timestamp = Date.now()
  const message   = `${config.ricId}:${timestamp}:`
  const msgBytes  = new TextEncoder().encode(message)
  const privBytes = hexToBytes(config.privateKeyHex)
  const sigBytes  = await ed.sign(msgBytes, privBytes)
  const sigHex    = bytesToHex(sigBytes)

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [HEADER_RULE_ID],
    addRules: [
      {
        id: HEADER_RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
          requestHeaders: [
            { header: 'X-RIC-ID',        operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: config.ricId },
            { header: 'X-RIC-Timestamp', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: String(timestamp) },
            { header: 'X-RIC-Signature', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: sigHex },
            { header: 'X-RIC-Version',   operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: '1.0' },
          ],
        },
        condition: {
          urlFilter: '|https://',
          resourceTypes: [
            'xmlhttprequest' as chrome.declarativeNetRequest.ResourceType,
            'main_frame'     as chrome.declarativeNetRequest.ResourceType,
            'sub_frame'      as chrome.declarativeNetRequest.ResourceType,
          ],
        },
      },
    ],
  })
}

// ── Lifecycle ─────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_MINUTES })
  await refreshHeaders()
})

chrome.runtime.onStartup.addListener(async () => {
  // Re-create alarm in case it was cleared during browser restart
  await chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_MINUTES })
  await refreshHeaders()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    refreshHeaders()
  }
})

// ── Messages from popup ───────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    getConfig().then((config) => {
      sendResponse({ configured: !!config, ricId: config?.ricId })
    })
    return true  // keep channel open for async response
  }

  if (message.type === 'SAVE_CONFIG') {
    chrome.storage.local.set(message.config).then(async () => {
      await refreshHeaders()
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === 'CLEAR_CONFIG') {
    chrome.storage.local.remove(['ricId', 'privateKeyHex', 'certificate']).then(async () => {
      await refreshHeaders()   // clears the inject rule
      sendResponse({ success: true })
    })
    return true
  }
})
