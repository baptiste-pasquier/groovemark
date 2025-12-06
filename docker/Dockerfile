# Multi-stage Dockerfile for the GrooveMark Vue app

# Stage 1: Build the application
FROM node:22-slim AS builder

# Build argument for Pocketbase URL
# This can be overridden at build time using --build-arg VITE_POCKETBASE_URL=<url>
ARG VITE_POCKETBASE_URL=http://localhost:8090

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
# Note: Using npm install without lockfile due to known npm ci issues
# In production CI/CD, the lockfile is included in the full context copy
RUN npm install

# Copy application source (including package-lock.json)
COPY . .

# Build the application with the VITE_POCKETBASE_URL environment variable
# Vite will embed this value into the built JavaScript files
RUN VITE_POCKETBASE_URL=${VITE_POCKETBASE_URL} npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
