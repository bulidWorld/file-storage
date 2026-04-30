FROM node:22-alpine
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
RUN apk add --no-cache libc6-compat openssl
RUN npm install -g npm@10.9.4
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate

EXPOSE 10530
CMD ["npm", "run", "dev"]
