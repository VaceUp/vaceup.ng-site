# VaceUp LMS - Backend Deployment Guide

## Overview
This guide covers deploying the VaceUp LMS backend to Truehost Cloud with the following architecture:
- **API Domain**: `api.vaceup.ng`
- **Frontend**: `https://vaceup.ng` (hosted separately on Cloudflare Pages/Vercel)
- **Database**: Truehost MySQL (Managed)
- **Redis**: Upstash or Truehost Redis
- **Storage**: Cloudflare R2 (S3-compatible)
- **LiveKit**: Self-hosted or LiveKit Cloud
- **Email**: SendGrid
- **Payments**: Paystack
- **Monitoring**: Sentry + Prometheus/Grafana

---

## Prerequisites

### Required Accounts & Services
- [ ] Truehost Cloud Account (MySQL + Redis)
- [ ] Cloudflare Account (DNS + R2 + SSL)
- [ ] SendGrid Account (Email)
- [ ] Paystack Account (Payments)
- [ ] LiveKit Cloud or Self-hosted
- [ ] Cloudflare R2 / AWS S3 (Media Storage)
- [ ] Sentry Account (Error Monitoring)
- [ ] GitHub Repository with CI/CD

---

## Quick Start Deployment

### 1. Clone & Configure
```bash
git clone <your-repo>
cd vaceup/backend
cp .env.example .env.production
# Edit .env.production with your production values
```

### 2. Build & Push Docker Image
```bash
# Build
docker build -t ghcr.io/your-org/vaceup:latest .

# Push to GHCR
docker push ghcr.io/your-org/vaceup:latest
```

### 3. Deploy to Truehost
```bash
# On Truehost server
docker-compose -f docker-compose.prod.yml up -d
```

---

## Environment Variables Reference

### Required (Must Set)
| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key (50+ chars) | `your-secret-key-here` |
| `JWT_SIGNING_KEY` | JWT signing key | `your-jwt-key-here` |
| `DB_PASSWORD` | MySQL password | `secure-password` |
| `DB_HOST` | MySQL host | `mysql.yourdomain.com` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key | `sk_test_xxx` |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key | `pk_test_xxx` |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook secret | `whsec_xxx` |
| `PAYSTACK_CALLBACK_URL` | Payment callback | `https://vaceup.ng/payment/callback` |
| `SENDGRID_API_KEY` | SendGrid API key | `SG.xxx` |
| `SENTRY_DSN` | Sentry DSN | `https://xxx@sentry.io/xxx` |
| `LIVEKIT_API_KEY` | LiveKit API key | `APIxxx` |
| `LIVEKIT_API_SECRET` | LiveKit secret | `xxx` |
| `LIVEKIT_WS_URL` | LiveKit WS URL | `wss://livekit.yourdomain.com` |
| `AWS_ACCESS_KEY_ID` | R2/S3 Access Key | `xxx` |
| `AWS_SECRET_ACCESS_KEY` | R2 Secret Key | `xxx` |
| `AWS_STORAGE_BUCKET_NAME` | Bucket name | `vaceup-media` |
| `AWS_S3_ENDPOINT_URL` | R2 Endpoint | `https://<account>.r2.cloudflarestorage.com` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | `abc123` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 Access Key | `xxx` |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 Secret Key | `xxx` |
| `SENTRY_DSN` | Sentry DSN | `https://xxx@sentry.io/xxx` |
| `SENTRY_ENVIRONMENT` | Environment name | `production` |
| `SENDGRID_API_KEY` | SendGrid API Key | `SG.xxx` |
| `PAYSTACK_SECRET_KEY` | Paystack Secret | `sk_test_xxx` |
| `PAYSTACK_PUBLIC_KEY` | Paystack Public Key | `pk_test_xxx` |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack Webhook Secret | `whsec_xxx` |
| `PAYSTACK_CALLBACK_URL` | Payment Callback | `https://vaceup.ng/payment/callback` |
| `LIVEKIT_API_KEY` | LiveKit API Key | `APIxxx` |
| `LIVEKIT_API_SECRET` | LiveKit Secret | `xxx` |
| `LIVEKIT_WS_URL` | LiveKit WS URL | `wss://livekit.yourdomain.com` |
| `SENTRY_DSN` | Sentry DSN | `https://xxx@sentry.io/xxx` |
| `SENDGRID_API_KEY` | SendGrid API Key | `SG.xxx` |

### Truehost MySQL Configuration
```env
DB_NAME=vaceup
DB_USER=vaceup
DB_PASSWORD=your_secure_password
DB_HOST=mysql.yourdomain.com  # or IP from Truehost
DB_PORT=3306
```

### Redis (Upstash/Truehost)
```env
REDIS_URL=redis://default:password@your-redis-host:6379/1
CELERY_BROKER_URL=redis://default:password@your-redis-host:6379/0
CELERY_RESULT_BACKEND=redis://default:password@your-redis-host:6379/0
```

### Cloudflare R2 / S3
```env
AWS_ACCESS_KEY_ID=your_r2_access_key
AWS_SECRET_ACCESS_KEY=your_r2_secret
AWS_STORAGE_BUCKET_NAME=vaceup-media
AWS_S3_REGION_NAME=auto
AWS_S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
AWS_S3_CUSTOM_DOMAIN=media.vaceup.ng
AWS_S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
```

### LiveKit
```env
LIVEKIT_API_KEY=APIxxx
LIVEKIT_API_SECRET=your_secret
LIVEKIT_WS_URL=wss://livekit.yourdomain.com
LIVEKIT_API_URL=https://livekit.yourdomain.com
```

### Paystack
```env
PAYSTACK_SECRET_KEY=sk_live_xxx
PAYSTACK_PUBLIC_KEY=pk_live_xxx
PAYSTACK_WEBHOOK_SECRET=whsec_xxx
PAYSTACK_CALLBACK_URL=https://vaceup.ng/payment/callback
PAYMENT_CURRENCY=NGN
```

### Email (SendGrid)
```env
SENDGRID_API_KEY=SG.xxx
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your_sendgrid_api_key
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=VaceUp <no-reply@vaceup.ng>
FRONTEND_BASE_URL=https://vaceup.ng
```

### Sentry
```env
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### LiveKit
```env
LIVEKIT_API_KEY=APIxxx
LIVEKIT_API_SECRET=your_secret
LIVEKIT_WS_URL=wss://livekit.yourdomain.com
LIVEKIT_API_URL=https://livekit.yourdomain.com
LIVE_CLASS_REMINDER_LEAD_MINUTES=30
LIVE_CLASS_JOIN_EARLY_MINUTES=10
LIVE_CLASS_JOIN_GRACE_MINUTES=15
```

### Paystack
```env
PAYSTACK_SECRET_KEY=sk_live_xxx
PAYSTACK_PUBLIC_KEY=pk_live_xxx
PAYSTACK_WEBHOOK_SECRET=whsec_xxx
PAYSTACK_CALLBACK_URL=https://vaceup.ng/payment/callback
PAYMENT_CURRENCY=NGN
```

### Sentry
```env
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### Celery & Redis
```env
REDIS_URL=redis://default:password@redis-host:6379/1
CELERY_BROKER_URL=redis://default:password@redis-host:6379/0
CELERY_RESULT_BACKEND=redis://default:password@redis-host:6379/0
CELERY_TASK_ALWAYS_EAGER=False
LIVE_CLASS_REMINDER_LEAD_MINUTES=30
```

---

## Deployment Steps

### 1. Prepare Truehost Server
```bash
# On Truehost server
sudo apt update && sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

### 2. Set Up Database (Truehost MySQL)
```sql
CREATE DATABASE vaceup CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'vaceup'@'%' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON vaceup.* TO 'vaceup'@'%';
FLUSH PRIVILEGES;
```

### 3. Set Up Redis (Upstash/Truehost)
Create Redis instance and note the connection URL.

### 4. Configure Cloudflare
1. Add DNS records:
   - `vaceup.ng` → Cloudflare proxy
   - `www.vaceup.ng` → Cloudflare proxy
   - `api.vaceup.ng` → Cloudflare proxy
   - `livekit.vaceup.ng` → Cloudflare proxy (WebSocket)
   - `media.vaceup.ng` → Cloudflare proxy (R2)
   - `static.vaceup.ng` → Cloudflare proxy

### 5. Deploy Application
```bash
# On server
cd /opt/vaceup
docker-compose -f docker-compose.prod.yml up -d
```

### 6. Run Migrations
```bash
docker-compose exec app python manage.py migrate
docker-compose exec app python manage.py collectstatic --noinput
docker-compose exec app python manage.py createsuperuser
```

### 5. SSL Certificate
```bash
sudo certbot --nginx -d vaceup.ng -d www.vaceup.ng -d api.vaceup.ng -d livekit.vaceup.ng
```

### 6. Configure Nginx
Copy `nginx/nginx.conf` to `/etc/nginx/sites-available/vaceup` and enable site.

### 7. Set Up Celery Workers
```bash
# Create systemd services for celery worker and beat
sudo cp deploy/celery-worker.service /etc/systemd/system/
sudo cp deploy/celery-beat.service /etc/systemd/system/
sudo systemctl enable celery-worker celery-beat
sudo systemctl start celery-worker celery-beat
```

### 7. Set Up Monitoring
- Configure Sentry DSN in environment
- Set up Prometheus + Grafana (optional)
- Configure Uptime monitoring (UptimeRobot/Better Uptime)

---

## DNS Records (Cloudflare)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | [Server IP] | Proxied |
| CNAME | www | @ | Proxied |
| CNAME | api | @ | Proxied |
| CNAME | livekit | @ | Proxied |
| CNAME | media | [R2 Domain] | Proxied |
| CNAME | static | @ | Proxied |
| CNAME | livekit | @ | Proxied (WS) |

---

## SSL/TLS Configuration

Cloudflare handles SSL termination. Ensure:
- SSL/TLS Encryption: **Full (Strict)**
- Always Use HTTPS: **On**
- Automatic HTTPS Rewrites: **On**
- Minimum TLS Version: TLS 1.2
- Minimum TLS Version (API): TLS 1.2

---

## Health Checks

```bash
# Application health
curl -f https://api.vaceup.ng/healthz/

# Database
docker-compose exec app python manage.py dbshell -c "SELECT 1;"

# Redis
redis-cli -h redis-host -a password ping

# Celery
celery -A config inspect ping
```

---

## Backup Strategy

### Database Backup (Daily)
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
docker exec vaceup-postgres pg_dump -U vaceup vaceup | gzip > /backups/vaceup_$DATE.sql.gz
# Upload to R2/S3
aws s3 cp /backups/vaceup_$DATE.sql.gz s3://vaceup-backups/db/
```

### Media Backup
```bash
# Sync media to R2
aws s3 sync /app/media s3://vaceup-media/backups/media/ --endpoint-url https://<account>.r2.cloudflarestorage.com
```

---

## Monitoring & Alerts

### Sentry
- Configure DSN in `.env`
- Set up alerts for errors > 5/min

### Uptime Monitoring
- UptimeRobot / Better Uptime
- Monitor: `https://api.vaceup.ng/healthz/`

### Log Aggregation
- Sentry for errors
- Loki/Grafana for logs (optional)
- Cloudflare Analytics for traffic

---

## Rollback Procedure

```bash
# Rollback to previous image
docker pull ghcr.io/your-org/vaceup:previous-tag
docker-compose -f docker-compose.prod.yml up -d
```

---

## Go-Live Checklist

- [ ] All environment variables set in production
- [ ] Database migrated (`python manage.py migrate`)
- [ ] Static files collected (`python manage.py collectstatic`)
- [ ] Superuser created (`createsuperuser`)
- [ ] SSL certificates valid (Cloudflare)
- [ ] DNS records pointing to server
- [ ] Paystack webhook registered: `https://api.vaceup.ng/api/v1/payments/webhook/`
- [ ] LiveKit server running and accessible
- [ ] Redis connected and working
- [ ] Celery workers running
- [ ] Celery Beat scheduler running
- [ ] Email sending tested
- [ ] Paystack webhook tested
- [ ] Sentry receiving errors
- [ ] Monitoring alerts configured
- [ ] Backup schedule verified
- [ ] Rollback plan documented

---

## Support Contacts

| Service | Contact |
|---------|---------|
| Truehost Support | support@truehost.cloud |
| Cloudflare Support | Cloudflare Dashboard |
| Paystack Support | support@paystack.com |
| LiveKit Support | support@livekit.io |
| Sentry | Sentry Dashboard |
| SendGrid | SendGrid Support |

---

## Quick Commands Reference

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f app
docker-compose -f docker-compose.prod.yml logs -f celery-worker
docker-compose -f docker-compose.prod.yml logs -f celery-beat
docker-compose -f docker-compose.prod.yml logs -f nginx

# Run management commands
docker-compose -f docker-compose.prod.yml exec app python manage.py migrate
docker-compose -f docker-compose.prod.yml exec app python manage.py collectstatic --noinput
docker-compose -f docker-compose.prod.yml exec app python manage.py createsuperuser

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale app=3 --scale celery-worker=4

# Backup
docker exec vaceup-postgres pg_dump -U vaceup vaceup | gzip > backup_$(date +%F).sql.gz

# Restore
gunzip -c backup_20240101.sql.gz | docker exec -i vaceup-postgres psql -U vaceup vaceup
```