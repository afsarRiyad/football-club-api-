FROM node:20-alpine

WORKDIR /app

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
