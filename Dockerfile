FROM node:20-alpine

WORKDIR /app

# Production environment — required for secure cookies, correct error
# responses and prod-mode email behavior. Must match Render's env config.
ENV NODE_ENV=production

# Copy package files first (better layer caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Switch to non-root user
USER nodeuser

EXPOSE 5000

CMD ["node", "server.js"]
