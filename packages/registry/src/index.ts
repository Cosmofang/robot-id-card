import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { registrationRoutes } from './routes/registration'
import { verifyRoutes } from './routes/verify'
import { auditRoutes } from './routes/audit'

const server = Fastify({ logger: true })

await server.register(cors, { origin: true })
await server.register(rateLimit, { max: 100, timeWindow: '1 minute' })

// Routes
await server.register(registrationRoutes, { prefix: '/v1/bots' })
await server.register(verifyRoutes, { prefix: '/v1/verify' })
await server.register(auditRoutes, { prefix: '/v1/audit' })

server.get('/health', async () => ({ status: 'ok', version: '0.1.0' }))

try {
  await server.listen({ port: 3000, host: '0.0.0.0' })
  console.log('RIC Registry running on http://localhost:3000')
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
