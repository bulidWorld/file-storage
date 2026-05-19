FROM node:22-alpine

# Use Aliyun mirrors for faster package downloads in China
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
RUN apk add --no-cache libc6-compat openssl

RUN npm install -g npm@10.9.4
WORKDIR /app

# Install dependencies (cacheable layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js for production
RUN npx next build

EXPOSE 10530

# Sync database schema then start
CMD sh -c "npx prisma db push --skip-generate && npm run start"
