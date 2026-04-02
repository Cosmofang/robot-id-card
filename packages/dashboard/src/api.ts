import type { BotSummary, BotDetail } from './types.js'

const REGISTRY_URL = import.meta.env.VITE_REGISTRY_URL || 'http://localhost:3000'

export async function fetchBots(): Promise<BotSummary[]> {
  const res = await fetch(`${REGISTRY_URL}/v1/bots`)
  if (!res.ok) throw new Error(`Registry error: ${res.status}`)
  const data = await res.json()
  return data.bots as BotSummary[]
}

export async function fetchBot(id: string): Promise<BotDetail> {
  const res = await fetch(`${REGISTRY_URL}/v1/bots/${id}`)
  if (!res.ok) throw new Error(`Bot not found: ${id}`)
  return res.json()
}
