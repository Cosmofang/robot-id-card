FROM node:20-slim

# Install build tools for better-sqlite3 (native module)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY packages/registry/package.json ./packages/registry/

# Install dependencies (compiles better-sqlite3 native bindings)
RUN npm ci --workspace=packages/registry

# Copy source files
COPY packages/registry/src ./packages/registry/src
COPY packages/registry/tsconfig.json ./packages/registry/
COPY packages/registry/assets ./packages/registry/assets

# Build TypeScript
RUN npm run build --workspace=packages/registry

ENV NODE_ENV=production
ENV PORT=10000
ENV RIC_DB_PATH=/data/registry.db

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:10000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "packages/registry/dist/index.js"]
