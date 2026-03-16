/**
 * @robot-id-card/sdk
 *
 * Drop-in middleware for websites to verify bot identity and enforce permission levels.
 * Compatible with Express, Fastify, Next.js, Koa, and vanilla Node.js.
 */

export { RICMiddleware } from './middleware/express'
export { RICFastifyPlugin } from './middleware/fastify'
export { verifyRICRequest, getRICHeaders } from './verify'
export type { RICVerifyResult, RICPermissionConfig, RICMiddlewareOptions } from './types'
