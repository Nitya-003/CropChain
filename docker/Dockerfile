# Stage 1: Shared base image
FROM node:22-alpine AS base
WORKDIR /app

# Stage 2: Frontend builder
FROM base AS frontend-builder
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY frontend/ ./frontend
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# Stage 3: Frontend runner (production)
FROM base AS frontend-runner
ENV NODE_ENV=production
RUN npm install -g serve@14.2.4
COPY --from=frontend-builder /app/frontend/dist ./dist
RUN chown -R node:node /app/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
CMD ["serve", "-s", "dist", "-l", "3000"]

# Backend dependency stage
FROM base AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/. ./

# Backend runner (production)
FROM base AS backend-runner
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend .
RUN chown -R node:node /app/backend
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1
CMD ["node", "server.js"]
