# Use the latest Node.js LTS base image
FROM node:20-alpine AS base

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock / pnpm-lock.yaml)
COPY package.json ./
COPY package-lock.json ./
# If you use yarn or pnpm, change the line above accordingly
# COPY yarn.lock ./
# COPY pnpm-lock.yaml ./

# Install dependencies for the production environment
FROM base AS deps
RUN npm ci --only=production

# Install all dependencies (including devDependencies) for the build environment
FROM base AS builder
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN npm run build

# Create production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy build artifacts from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node ./.next/standalone ./
COPY --from=builder --chown=node:node ./.next/static ./.next/static

# Expose port
EXPOSE 3000

# CMD command to start the application
CMD ["node", "server.js"]