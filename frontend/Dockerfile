# Sử dụng base image Node.js LTS mới nhất
FROM node:20-alpine AS base

# Thiết lập thư mục làm việc
WORKDIR /app

# Sao chép package.json và package-lock.json (hoặc yarn.lock / pnpm-lock.yaml)
COPY package.json ./
COPY package-lock.json ./
# Nếu bạn sử dụng yarn hoặc pnpm, hãy thay đổi dòng trên cho phù hợp
# COPY yarn.lock ./
# COPY pnpm-lock.yaml ./

# Cài đặt dependencies cho môi trường production
FROM base AS deps
RUN npm ci --only=production

# Cài đặt tất cả dependencies (bao gồm devDependencies) cho môi trường build
FROM base AS builder
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN npm run build

# Tạo image production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Sao chép build artifacts từ builder stage
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node ./.next/standalone ./
COPY --from=builder --chown=node:node ./.next/static ./.next/static

# Expose port
EXPOSE 3000

# Lệnh CMD để khởi chạy ứng dụng
CMD ["node", "server.js"]