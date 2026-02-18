# Deployment Guide 🚀

This guide provides step-by-step instructions for deploying OrderFlow in various environments, from local development to production-ready VPS setups.

## Deployment Strategies

| Strategy | Ideal For | Effort | Cost | Reliability |
|----------|-----------|--------|------|-------------|
| **Local (Docker Compose)** | Development, Testing | Low | $0 | Low |
| **VPS (Cloud VM)** | Demo, Small Scale | Medium | $5-20/mo | Medium |
| **PaaS (Railway/Render)** | Fast Iteration | Low | Usage-based | High |
| **Kubernetes (EKS/GKE)** | Production, High Scale | High | $$$ | Very High |

---

## 🏗️ 1. Infrastructure Requirements

Before deploying, ensure you have the following components:

### A. Managed or Self-Hosted Services
- **Kafka Cluster**: Required for service communication.
- **PostgreSQL**: Three separate databases (or one server with three logical DBs).
- **Redis (Optional)**: For advanced caching or rate limiting.

### B. Suggested Specs (VPS)
- **CPU**: 2+ Cores
- **RAM**: 4GB+ (Kafka and 6+ containers need breathing room)
- **Disk**: 20GB+ SSD

---

## 🔑 2. Environment Configuration

You must configure these variables across all services. 

> [!TIP]
> Use a `.env` file for local development and Secret Management (like GitHub Secrets or Vault) for production.

### Global Configuration
| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `KAFKA_BROKERS` | List of Kafka brokers | `kafka:9092` |
| `JWT_SECRET` | Secret for auth tokens | `your-super-secret-key` |

### Service-Specific Configuration
| Service | Variable | Value Example |
|---------|----------|---------------|
| **Order** | `DATABASE_URL` | `postgresql://user:pass@host:5432/orderdb` |
| **Order** | `PORT` | `3001` |
| **Inventory** | `DATABASE_URL` | `postgresql://user:pass@host:5432/inventorydb` |
| **Inventory** | `PORT` | `3002` |
| **Payment** | `DATABASE_URL` | `postgresql://user:pass@host:5432/paymentdb` |
| **Payment** | `PORT` | `3003` |
| **Dashboard** | `NEXT_PUBLIC_ORDER_API_URL` | `https://api.yourdomain.com/orders` |

---

## 🚢 3. VPS Deployment (AWS Lightsail / EC2)

For AWS, you have two primary "cheap" options. Both use **Docker Compose** to run the entire stack on one machine.

### Option A: AWS Lightsail (Recommended Cheapest - $3.50/mo)
Lightsail is the simplest way to get started on AWS with a fixed, predictable cost.

1.  **Create Instance**: Choose "Linux/Unix", "OS Only", and "Ubuntu 22.04 LTS".
2.  **Pick Plan**: The $3.50/mo plan (512MB RAM) is too small. **Choose the $5/mo plan (1GB RAM)** or higher.
3.  **Setup**: Connect via SSH and run the preparation script:
    ```bash
    curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
    git clone https://github.com/IsVohi/OrderFlow.git
    cd OrderFlow
    docker-compose -f infra/docker/docker-compose.yml up -d
    ```

### Option B: AWS EC2 Free Tier ($0 for 12 months)
If you are using a `t2.micro` or `t3.micro` instance (1GB RAM), follow these exact steps to ensure the system doesn't crash.

#### Step 1: Launch Instance & Security Group
When launching your EC2 instance (Ubuntu 22.04), configure the **Security Group** to allow:
- **SSH (22)**: From your IP.
- **HTTP (80)** & **HTTPS (443)**: From anywhere.
- **Technical Testing (optional)**: Open `3000-3004` and `8080`, `16686` if you want to access UIs directly without a reverse proxy.

#### Step 2: Setup Swap File (CRITICAL)
1GB of RAM is not enough for Kafka + Microservices. You **must** add swap:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

#### Step 3: Install Docker & Compose
Depending on your EC2 Operating System, run the correct set of commands:

**For Ubuntu (Default in some regions):**
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker $USER
```

**For Amazon Linux (AWS Default):**
```bash
sudo dnf update -y
sudo dnf install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Download Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**Note:** Run `newgrp docker` or log out/in to apply permissions.

#### Step 4: Deploy Core Services
To save memory on the Free Tier, consider starting only the core services first:
```bash
git clone https://github.com/IsVohi/OrderFlow.git
cd OrderFlow
# Run only databases and core microservices
docker-compose -f infra/docker/docker-compose.yml up -d zookeeper kafka order-db inventory-db payment-db auth-db
# Wait 30s, then start services
docker-compose -f infra/docker/docker-compose.yml up -d order-service inventory-service payment-service dashboard
```

#### Step 5: Configure Dashboard API URLs
Since the Dashboard is a client-side application, it needs to know the public IP or domain of your EC2 instance to talk to the APIs.

1. Open `infra/docker/docker-compose.yml`.
2. Find the `dashboard` service.
3. Update the `NEXT_PUBLIC_` variables with your EC2 Public IP:
```yaml
  dashboard:
    ...
    environment:
      - NEXT_PUBLIC_ORDER_API_URL=http://your-ec2-ip:3001
      - NEXT_PUBLIC_INVENTORY_API_URL=http://your-ec2-ip:3002
      - NEXT_PUBLIC_PAYMENT_API_URL=http://your-ec2-ip:3003
```

#### Step 6: Final Deploy
```bash
# Pull the latest changes with the new Dockerfiles
git pull origin main

# Build and start everything
docker-compose -f infra/docker/docker-compose.yml up -d --build
```

## ☁️ 4. Cloud Considerations (Managed Services)

When moving to managed services:

1. **Kafka**: Use Confluent Cloud or Amazon MSK instead of self-hosting in Docker.
2. **Database**: Use Amazon RDS or Google Cloud SQL.
3. **Secrets**: Use AWS Secrets Manager or HashiCorp Vault.
4. **SSL/TLS**: Terminate SSL at the Load Balancer/Ingress level.

---

## ✅ 5. Post-Deployment Checklist

- [ ] Verify health endpoints: `GET /health/ready` on all services.
- [ ] Seed initial products using `seed_data.sh`.
- [ ] Check Kafka connectivity in logs `docker-compose logs -f inventory-service`.
- [ ] Set up monitoring (Prometheus/Grafana) included in `infra/observability`.

---

## 🛠️ 7. Troubleshooting

### 1. "Service Health: Down" in Dashboard (Next.js Env Vars)

**Symptom:**
Dashboard loads but all services show "Down". `curl` to backend works fine.

**Cause:**
Next.js inlines `NEXT_PUBLIC_` environment variables at **build time**. If you only provide them at runtime (in `docker-compose.yml`), the browser code will have `undefined` API URLs.

**Solution:**
You must pass these variables as `args` in `docker-compose.yml` and use `ARG` + `ENV` in the `Dockerfile`.
```yaml
dashboard:
  build:
    args:
      NEXT_PUBLIC_ORDER_API_URL: ...
```

### 2. "libquery_engine-darwin.dylib.node: invalid ELF header" (Prisma Binary Mismatch)

**Symptom:**
Node.js services crash on Linux (EC2/Docker) with an error about `darwin.dylib`.

**Cause:**
You ran `prisma generate` on your Mac, and the `Dockerfile` copied the macOS binary into the Linux container.

**Solution:**
Ensure `prisma generate` runs **inside the Dockerfile** (specifically in the `build` stage), not just on your host machine.

### 3. "Schema not found" during Migrations

**Symptom:**
`prisma migrate deploy` fails saying `schema.prisma` is missing, even though it's in the repo.

**Solution:**
Production Docker images often prune source files. You must mount the schema file (or the whole `prisma` directory) into the container at runtime to run migrations:
```yaml
volumes:
  - ./apps/order-service/src/infrastructure/persistence/prisma:/app/prisma
```

### 4. `KeyError: 'ContainerConfig'` during `docker-compose up`

**Symptom:**
```
File "/usr/lib/python3/dist-packages/compose/service.py", line 1579, in get_container_data_volumes
container.image_config['ContainerConfig'].get('Volumes') or {}
KeyError: 'ContainerConfig'
```

**Cause:**
This is a bug in older versions of `docker-compose` (v1.29.2) when trying to recreate containers built with newer Docker BuildKit.

**Solution:**
You need to manually remove the stopped containers so `docker-compose` creates them fresh instead of trying to recreate them.

```bash
# Remove the specific containers causing the error
docker rm -f orderflow-order-service orderflow-inventory-service orderflow-payment-service

# Or remove all stopped containers (be careful)
docker rm -f $(docker ps -a -q)

# Then run up again
docker-compose -f infra/docker/docker-compose.yml up -d --build
```
### "No space left on device" (EC2/VPS)
If your Docker build fails with this error, your server's disk (usually 8GB on Free Tier) is full.
1. **Clean Docker Storage**: 
   ```bash
   docker system prune -f
   docker image prune -a -f
   ```
2. **Check Disk Usage**: `df -h`
3. **Optimize Build**: We've included a `.dockerignore` file to keep the build context small.
4. **Increase EBS Volume**: If pruning doesn't help, increase your volume to 16GB or 20GB in the AWS EC2 Console.

### "No such service" Error
Ensure you are in the project root and pointing to the correct compose file:
`docker-compose -f infra/docker/docker-compose.yml up -d`

### Kafka Connection Failures
Check if Kafka is alive: `docker-compose -f infra/docker/docker-compose.yml ps`.
If it's stuck in "Starting", check your RAM levels (`free -m`). Adding a **Swap File** (Step 2) is usually the fix.

---

*Need help? Open an issue on [GitHub](https://github.com/IsVohi/OrderFlow/issues).*

