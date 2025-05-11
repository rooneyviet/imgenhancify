# Use Node.js LTS with Debian (not Alpine) for build stage
FROM node:20 AS base

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json ./
COPY package-lock.json ./

# Install all dependencies (including dev dependencies)
FROM base AS builder
# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci
COPY . .
# Generate Prisma Client before building
RUN npx prisma generate
# Set NODE_ENV to production for the build
ENV NODE_ENV=production
RUN npm run build

# Create production image - use Alpine for the runner as it's smaller
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy build artifacts from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose port
EXPOSE 3000

# Use non-root user for better security
USER node

# CMD command to start the application
CMD ["node", "server.js"]