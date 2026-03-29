# Use official Node.js LTS Alpine image (lightweight)
FROM node:20-alpine

# Set maintainer
LABEL maintainer="Billing System MongoDB"
LABEL description="ISP Billing System with MongoDB - Production Ready"

# Set working directory
WORKDIR /app

# Install system dependencies
# Required for some npm packages and better compatibility
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    bash

# Copy package files first (for better caching)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p \
    data \
    whatsapp-session \
    public/img/packages \
    logs && \
    chmod -R 755 data whatsapp-session public/img/packages logs

# Make scripts executable
RUN chmod +x start.sh && \
    chmod +x scripts/*.js 2>/dev/null || true

# Expose application port
EXPOSE 4555

# Set environment variables
ENV NODE_ENV=production \
    PORT=4555

# Health check - verify app is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4555/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start application using startup script
CMD ["./start.sh"]
