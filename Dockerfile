# Stage 1: Shared base image
FROM node:20-alpine AS base
WORKDIR /app

# Stage 2: Frontend builder
FROM base AS frontend-builder
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.app.json ./
COPY tsconfig.node.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY src ./src
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 3: Frontend runner (production)
FROM base AS frontend-runner
ENV NODE_ENV=production
RUN npm install -g serve@14.2.4
COPY --from=frontend-builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]

# Backend dependency stage
FROM base AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
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
CMD ["node", "server.js"]