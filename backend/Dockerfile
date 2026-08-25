# --------- Build Stage ---------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all files
COPY . .

# Clean slate
RUN rm -rf node_modules package-lock.json

# Install dependencies
RUN npm install

# Generate prisma client & build backend
RUN npx prisma generate
RUN npm run build

# --------- Production Stage ---------
FROM node:20-alpine AS production

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Create uploads directory
RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push && npm run start"]
