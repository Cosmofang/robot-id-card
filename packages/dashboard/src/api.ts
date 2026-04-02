import type { BotSummary, BotDetail } from './types.js'

const REGISTRY_URL = import.meta.env.VITE_REGISTRY_URL || 'http://localhost:3000'

export interface BotsResponse {
  total: number
  page: number
  limit: number
  pages: number
  bots: BotSummary[]
}

export async function fetchBots(params?: { grade?: string; page?: number; limit?: number }): Promise<BotsResponse> {
  const qs = new URLSearchParams()
  if (params?.grade) qs.set('grade', params.grade)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const query = qs.toString() ? `?${qs}` : ''
  const res = await fetch(`${REGISTRY_URL}/v1/bots${query}`)
  if (!res.ok) throw new Error(`Registry error: ${res.status}`)
  return res.json()
}

export async function fetchBot(id: string): Promise<BotDetail> {
  const res = await fetch(`${REGISTRY_URL}/v1/bots/${id}`)
  if (!res.ok) throw new Error(`Bot not found: ${id}`)
  return res.json()
}
