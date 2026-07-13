# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package management files
COPY package*.json ./

# Install ALL dependencies (including devDependencies if needed for build/compilation)
# Using `npm ci` ensures repeatable builds from package-lock.json
RUN npm ci

# Copy the rest of the application files
COPY . .

# Prune devDependencies to keep the size small for release
RUN npm prune --omit=dev

# Stage 2: Release
FROM node:20-alpine AS runner

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /usr/src/app

# Create logs directory
RUN mkdir -p /usr/src/app/logs

# Copy production dependencies and source from builder with correct ownership
COPY --from=builder --chown=node:node /usr/src/app/package*.json ./
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/app.js ./app.js
COPY --from=builder --chown=node:node /usr/src/app/server.js ./server.js
COPY --from=builder --chown=node:node /usr/src/app/swagger.js ./swagger.js
COPY --from=builder --chown=node:node /usr/src/app/config ./config
COPY --from=builder --chown=node:node /usr/src/app/constants ./constants
COPY --from=builder --chown=node:node /usr/src/app/controllers ./controllers
COPY --from=builder --chown=node:node /usr/src/app/jobs ./jobs
COPY --from=builder --chown=node:node /usr/src/app/middleware ./middleware
COPY --from=builder --chown=node:node /usr/src/app/models ./models
COPY --from=builder --chown=node:node /usr/src/app/routes ./routes
COPY --from=builder --chown=node:node /usr/src/app/scripts ./scripts
COPY --from=builder --chown=node:node /usr/src/app/services ./services
COPY --from=builder --chown=node:node /usr/src/app/startup ./startup
COPY --from=builder --chown=node:node /usr/src/app/utils ./utils
COPY --from=builder --chown=node:node /usr/src/app/validations ./validations

# Ensure node:node owns the app and logs directories
RUN chown -R node:node /usr/src/app

# Run as non-root user for security (ECS container security best practice)
USER node

# Expose port
EXPOSE 3001

# Healthcheck to monitor container status (crucial for ECS target group checks)
# Since we are on alpine, we can use wget as a lightweight check tool.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
