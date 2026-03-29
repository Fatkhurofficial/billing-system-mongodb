# Use official Node.js LTS Alpine image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    bash \
    git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production --no-optional && \
    npm cache clean --force

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p \
    data \
    whatsapp-session \
    public/img/packages \
    logs && \
    chmod -R 755 data whatsapp-session public/img/packages logs

# Make scripts executable
RUN chmod +x start.sh 2>/dev/null || true && \
    chmod +x scripts/*.js 2>/dev/null || true

# Expose port (Koyeb will use PORT env var)
EXPOSE 8000

# Set environment variables
# PORT will be set by Koyeb, default to 8000
ENV NODE_ENV=production \
    PORT=8000

# Health check - check on PORT environment variable
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8000; require('http').get(\`http://localhost:\${port}/health\`, (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start application
CMD ["./start.sh"]
