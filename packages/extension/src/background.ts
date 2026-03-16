/**
 * RIC Browser Extension — Background Service Worker
 *
 * Intercepts outgoing HTTP requests and injects RIC identity headers.
 * The bot's private key signs each request with a timestamp to prevent replay.
 */

import * as ed from '@noble/ed25519'

interface RICConfig {
  ricId: string
  privateKeyHex: string
  certificate: object
}

// Load config from extension storage
async function getConfig(): Promise<RICConfig | null> {
  const result = await chrome.storage.local.get(['ricId', 'privateKeyHex', 'certificate'])
  if (!result.ricId || !result.privateKeyHex) return null
  return result as RICConfig
}

// Sign a request message with Ed25519 private key
async function signRequest(privateKeyHex: string, ricId: string, url: string): Promise<{
  timestamp: number
  signature: string
}> {
  const timestamp = Date.now()
  const message = `${ricId}:${timestamp}:${url}`
  const msgBytes = new TextEncoder().encode(message)
  const privKeyBytes = Buffer.from(privateKeyHex, 'hex')
  const sig = await ed.sign(msgBytes, privKeyBytes)
  return {
    timestamp,
    signature: Buffer.from(sig).toString('hex'),
  }
}

// Intercept requests and inject RIC headers
chrome.webRequest?.onBeforeSendHeaders.addListener(
  async (details) => {
    const config = await getConfig()
    if (!config) return {}  // Not configured, don't inject

    const { timestamp, signature } = await signRequest(
      config.privateKeyHex,
      config.ricId,
      details.url
    )

    const headers = details.requestHeaders || []
    headers.push(
      { name: 'X-RIC-ID', value: config.ricId },
      { name: 'X-RIC-Timestamp', value: String(timestamp) },
      { name: 'X-RIC-Signature', value: signature },
      { name: 'X-RIC-Version', value: '1.0' },
    )

    return { requestHeaders: headers }
  },
  { urls: ['<all_urls>'] },
  ['blocking', 'requestHeaders']
)

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    getConfig().then((config) => {
      sendResponse({ configured: !!config, ricId: config?.ricId })
    })
    return true  // keep channel open for async response
  }

  if (message.type === 'SAVE_CONFIG') {
    chrome.storage.local.set(message.config).then(() => {
      sendResponse({ success: true })
    })
    return true
  }
})
