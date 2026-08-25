# --------- Build Stage ---------
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args for Vite env variables
ARG VITE_API_URL=/api/v1
ARG VITE_SOCKET_URL=/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Copy all files first
COPY . .

# Remove any existing node_modules or lockfiles to ensure clean install
RUN rm -rf node_modules package-lock.json

# Install dependencies
RUN npm install

# Build the frontend
RUN npm run build

# --------- Production Stage ---------
# Use nginx to serve the static built files
FROM nginx:alpine

# Install certbot for SSL
RUN apk add --no-cache certbot certbot-nginx openssl

# Copy the built Vite output from /app/dist to nginx html dir
COPY --from=builder /app/dist /usr/share/nginx/html

# Add nginx configuration for SPA fallback and API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Script: obtain SSL on first run, then start nginx
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80 443

CMD ["/docker-entrypoint.sh"]
