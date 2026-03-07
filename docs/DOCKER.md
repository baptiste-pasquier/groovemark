# Docker Deployment Guide

This guide provides detailed instructions for deploying GrooveMark using Docker and Docker Compose.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Docker Images](#docker-images)
- [Configuration](#configuration)
- [Production Deployment](#production-deployment)
- [CI/CD with GitHub Actions](#cicd-with-github-actions)
- [Troubleshooting](#troubleshooting)

## Overview

GrooveMark uses a multi-container setup with:

- **App Container**: Vue 3 application served by nginx
- **Pocketbase Container**: Backend database and API

Both containers are orchestrated using Docker Compose for easy deployment and management.

## Prerequisites

- Docker Engine 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose 2.0+ ([Install Docker Compose](https://docs.docker.com/compose/install/))

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/baptiste-pasquier/groovemark.git
cd groovemark/docker
```

### 2. Start the Services

```bash
docker-compose up -d
```

This will:

- Build both Docker images
- Start the Pocketbase backend on port 8090
- Start the GrooveMark app on port 8080
- Create a Docker volume for data persistence

### 3. Access the Application

- **GrooveMark App**: http://localhost:8080
- **Pocketbase Admin**: <http://localhost:8090/_/>

### 4. Configure Pocketbase

On first run, visit <http://localhost:8090/_/> to:

1. Create an admin account
2. Configure the `favorites` collection (see [POCKETBASE_SCHEMA.md](./POCKETBASE_SCHEMA.md))
3. Set up authentication (optional)

## Docker Images

### Application Image (Dockerfile)

The app uses a multi-stage build:

**Stage 1 - Builder:**

- Base: `node:22-slim`
- Installs dependencies with npm
- Builds the Vue application

**Stage 2 - Runtime:**

- Base: `nginx:alpine`
- Copies built assets from builder stage
- Serves the app with nginx
- Includes custom nginx configuration for SPA routing

### Pocketbase Image (Dockerfile.pocketbase)

- Base: `alpine:latest`
- Downloads Pocketbase v0.34.2 (configurable)
- Exposes port 8090
- Data stored in `/pb/pb_data` volume

## Configuration

### Environment Variables

The `VITE_POCKETBASE_URL` environment variable is used to configure the Pocketbase backend URL. **This variable is embedded into the application at build time**, not at runtime.

#### For Local Development with Docker Compose

Create a `.env` file in the `docker` directory:

```bash
# Pocketbase URL - this will be used when building the Docker image
VITE_POCKETBASE_URL=http://pocketbase:8090
```

The default value is `http://pocketbase:8090` which allows the containerized app to communicate with the Pocketbase service.

#### For Production Deployments

Set the `VITE_POCKETBASE_URL` environment variable before building the Docker image:

```bash
# Build with custom Pocketbase URL
VITE_POCKETBASE_URL=https://api.yourdomain.com docker-compose build app

# Or set it in your .env file
echo "VITE_POCKETBASE_URL=https://api.yourdomain.com" > docker/.env
cd docker && docker-compose build app
```

#### For GitHub Actions / CI/CD

The `VITE_POCKETBASE_URL` is passed as a build argument in the GitHub Actions workflow. You can set it as a repository variable:

1. Go to your repository Settings → Secrets and variables → Actions → Variables
2. Add a new variable named `VITE_POCKETBASE_URL`
3. Set the value to your production Pocketbase URL (e.g., `https://api.yourdomain.com`)

The workflow will use this variable when building the Docker image, or default to `http://localhost:8090` if not set.

**Note:** Because the URL is embedded at build time, you need to rebuild the Docker image if you want to change the Pocketbase URL.

### Port Configuration

Edit `docker/docker-compose.yml` to change exposed ports:

```yaml
services:
  pocketbase:
    ports:
      - '8090:8090' # Change left side for external port

  app:
    ports:
      - '8080:80' # Change left side for external port
```

### Volume Management

Pocketbase data is stored in a named Docker volume:

```bash
# View volumes
docker volume ls

# Inspect volume
docker volume inspect groovemark_pocketbase_data

# Backup volume
docker run --rm -v groovemark_pocketbase_data:/data -v $(pwd):/backup alpine tar czf /backup/pocketbase-backup.tar.gz /data

# Restore volume
docker run --rm -v groovemark_pocketbase_data:/data -v $(pwd):/backup alpine tar xzf /backup/pocketbase-backup.tar.gz -C /
```

## Production Deployment

### 1. Use Production Compose File

```bash
cd docker
docker-compose -f docker-compose.prod.yml up -d
```

This will use pre-built images from GitHub Container Registry instead of building locally.

### 2. Configure Domain and HTTPS

Update your environment:

```bash
VITE_POCKETBASE_URL=https://api.yourdomain.com
```

### 3. Add Reverse Proxy (Recommended)

Use nginx or Traefik to:

- Terminate SSL/TLS
- Proxy requests to containers
- Add security headers

Example nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. Security Considerations

- [ ] Use strong passwords for Pocketbase admin
- [ ] Configure Pocketbase authentication rules
- [ ] Enable HTTPS in production
- [ ] Regular backups of Pocketbase data
- [ ] Keep Docker images updated
- [ ] Use Docker secrets for sensitive data
- [ ] Implement rate limiting
- [ ] Configure CORS properly

## CI/CD with GitHub Actions

The project includes a GitHub Actions workflow (`.github/workflows/docker-build.yml`) that automatically:

### On Push to `main` or `develop`:

- Builds Docker images for both services
- Pushes images to GitHub Container Registry (ghcr.io)
- Tags images with branch name and commit SHA
- Supports multi-platform builds (linux/amd64, linux/arm64)

### On Tag Push (`v*`):

- Creates versioned releases
- Tags images with semantic versions (e.g., `v1.0.0`, `1.0`, `1`)

### Using CI/CD Images

The production compose file (`docker-compose.prod.yml`) is already configured to use pre-built images from GitHub Container Registry:

```bash
cd docker
docker-compose -f docker-compose.prod.yml up -d
```

You can also pull images manually:

```bash
# Latest version
docker pull ghcr.io/baptiste-pasquier/groovemark:latest
docker pull ghcr.io/baptiste-pasquier/groovemark-pocketbase:latest

# Specific version
docker pull ghcr.io/baptiste-pasquier/groovemark:v1.0.0
docker pull ghcr.io/baptiste-pasquier/groovemark-pocketbase:v1.0.0

# Specific commit
docker pull ghcr.io/baptiste-pasquier/groovemark:main-abc1234
```

## Troubleshooting

### Container Won't Start

Check logs:

```bash
docker-compose logs app
docker-compose logs pocketbase
```

### Pocketbase Data Not Persisting

Verify volume is mounted:

```bash
docker inspect groovemark-pocketbase | grep -A 10 Mounts
```

### App Can't Connect to Pocketbase

1. Check if both containers are on the same network:

```bash
docker network inspect groovemark_default
```

2. Verify environment variable:

```bash
docker-compose exec app printenv VITE_POCKETBASE_URL
```

3. Test connectivity:

```bash
docker-compose exec app wget -O- http://pocketbase:8090/api/health
```

### Permission Issues

Fix volume permissions:

```bash
docker-compose exec pocketbase chown -R 1000:1000 /pb/pb_data
```

### Rebuild Images

Force rebuild without cache:

```bash
docker-compose build --no-cache
docker-compose up -d
```

### View Resource Usage

```bash
docker stats
```

### Clean Up

Remove containers and volumes:

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Remove unused images
docker image prune -a
```

## Health Checks

Both services include health checks:

### Application

- Endpoint: `http://localhost/health`
- Returns: `200 OK` with "healthy" text

### Pocketbase

- Endpoint: `http://localhost:8090/api/health`
- Returns: `200 OK`

Check health status:

```bash
docker-compose ps
```

## Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f pocketbase

# Last 100 lines
docker-compose logs --tail=100
```

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  pocketbase:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
```

## Updates

### Update to Latest Images

```bash
# Pull latest images
docker-compose pull

# Recreate containers
docker-compose up -d
```

### Update Specific Service

```bash
# Rebuild and restart app
docker-compose up -d --build app

# Restart pocketbase only
docker-compose restart pocketbase
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Pocketbase Documentation](https://pocketbase.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
