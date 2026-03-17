import type { RICVerifyResult } from './types.js'

const DEFAULT_REGISTRY = 'https://registry.robotidcard.dev'

/** Simple in-process cache */
const cache = new Map<string, { result: RICVerifyResult; expiresAt: number }>()

export function getRICHeaders(req: { headers: Record<string, string | undefined> }) {
  return {
    ricId: req.headers['x-ric-id'],
    timestamp: req.headers['x-ric-timestamp'],
    signature: req.headers['x-ric-signature'],
  }
}

/**
 * Verify an incoming request's RIC identity by calling the registry.
 * Results are cached for `cacheTtl` seconds (default 300).
 */
export async function verifyRICRequest(
  headers: { ricId?: string; timestamp?: string; signature?: string },
  options: { registryUrl?: string; cacheTtl?: number } = {}
): Promise<RICVerifyResult | null> {
  const { ricId, timestamp, signature } = headers
  if (!ricId || !timestamp || !signature) return null

  const cacheKey = `${ricId}:${timestamp}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result
  }

  const registryUrl = options.registryUrl || DEFAULT_REGISTRY
  const cacheTtl = (options.cacheTtl ?? 300) * 1000

  try {
    const res = await fetch(`${registryUrl}/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ric_id: ricId,
        timestamp: Number(timestamp),
        signature,
        message: '',  // URL is passed optionally for stricter verification
      }),
    })

    const result: RICVerifyResult = await res.json()

    cache.set(cacheKey, { result, expiresAt: Date.now() + cacheTtl })
    return result
  } catch {
    return null
  }
}

/** Grade hierarchy for comparison */
const GRADE_RANK: Record<string, number> = { dangerous: 0, unknown: 1, healthy: 2 }

export function meetsGradeRequirement(grade: string, minGrade: string): boolean {
  return (GRADE_RANK[grade] ?? 0) >= (GRADE_RANK[minGrade] ?? 0)
}
