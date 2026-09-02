# VaceUp LMS - Production Deployment Guide

## Overview

This document provides comprehensive instructions for deploying VaceUp LMS to production using Kubernetes with Docker containers.

## Prerequisites

- Kubernetes cluster (v1.28+)
- kubectl configured
- Helm 3.x installed
- cert-manager installed
- NGINX Ingress Controller installed
- cert-manager installed
- Prometheus Operator installed (for monitoring)

## Quick Start

### 1. Create Namespace
```bash
kubectl create namespace vaceup
```

### 2. Apply Secrets (Update with real values first!)
```bash
# Edit k8s/base/secrets.yaml with real values, then:
kubectl apply -f k8s/base/secrets.yaml
```

### 3. Apply ConfigMaps
```bash
kubectl apply -f k8s/base/configmap.yaml
```

### 4. Apply RBAC
```bash
kubectl apply -f k8s/base/rbac.yaml
```

### 5. Deploy Applications
```bash
kubectl apply -f k8s/base/deployment.yaml
kubectl apply -f k8s/base/celery.yaml
kubectl apply -f k8s/base/nginx.yaml
```

### 6. Apply Monitoring
```bash
kubectl apply -f k8s/base/servicemonitor.yaml
```

### 7. Apply Autoscaling
```bash
kubectl apply -f k8s/base/hpa.yaml
```

### 8. Apply Pod Disruption Budgets
```bash
kubectl apply -f k8s/base/pdb.yaml
```

### 9. Apply Ingress & Cert Manager
```bash
kubectl apply -f k8s/base/cert-manager.yaml
kubectl apply -f k8s/base/ingress.yaml
```

### 9. Apply Pod Disruption Budgets
```bash
kubectl apply -f k8s/base/pdb.yaml
```

## Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n vaceup

# Check services
kubectl get svc -n vaceup

# Check ingress
kubectl get ingress -n vaceup

# Check HPA
kubectl get hpa -n vaceup

# Check pods
kubectl get pods -n vaceup -o wide
```

## Verify Application

```bash
# Health check
curl https://api.vaceup.ng/healthz/

# API test
curl https://api.vaceup.ng/api/v1/courses/

# Check logs
kubectl logs -n vaceup -l app=vaceup-app --tail=100
```

## Configuration Reference

### Required Secrets (k8s/base/secrets.yaml)

| Secret Key | Description | Required |
|------------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection URL | Yes |
| `SECRET_KEY` | Django secret key (50+ chars) | Yes |
| `JWT_SIGNING_KEY` | JWT signing key | Yes |
| `PAYSTACK_SECRET_KEY` | Paystack secret key | Yes |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key | Yes |
| `PAYSTACK_CALLBACK_URL` | Payment callback URL | Yes |
| `PAYMENT_CURRENCY` | Currency code (NGN) | Yes |
| `LIVEKIT_API_KEY` | LiveKit API key | Optional* |
| `LIVEKIT_API_SECRET` | LiveKit API secret | Optional* |
| `LIVEKIT_WS_URL` | LiveKit WebSocket URL | Optional* |
| `SENTRY_DSN` | Sentry DSN | Optional |
| `AWS_ACCESS_KEY_ID` | S3/R2 access key | Optional* |
| `AWS_SECRET_ACCESS_KEY` | S3/R2 secret key | Optional* |
| `AWS_STORAGE_BUCKET_NAME` | S3 bucket name | Optional* |
| `AWS_S3_REGION_NAME` | S3 region | Optional* |
| `AWS_S3_ENDPOINT_URL` | S3 endpoint (for R2) | Optional* |

*Optional for development, required for production features

### ConfigMap Values (k8s/base/configmap.yaml)

| Key | Description | Default |
|-----|-------------|---------|
| `CELERY_TASK_ALWAYS_EAGER` | Run Celery tasks synchronously | `False` |
| `PAYMENT_CURRENCY` | Default currency | `NGN` |
| `FRONTEND_BASE_URL` | Frontend URL | `https://vaceup.ng` |
| `API_BASE_URL` | API base URL | `https://api.vaceup.ng` |
| `LIVE_CLASS_REMINDER_LEAD_MINUTES` | Reminder lead time | `30` |
| `LIVE_CLASS_JOIN_EARLY_MINUTES` | Early join window | `10` |
| `LIVE_CLASS_JOIN_GRACE_MINUTES` | Grace period | `15` |

## Monitoring & Observability

### Prometheus Metrics
- Application metrics: `/metrics/` on each service
- ServiceMonitors configured for Prometheus Operator
- Key metrics: request latency, error rates, queue depths, active users

### Health Checks
- Liveness: `GET /healthz/`
- Readiness: `GET /healthz/`

### Key Metrics to Monitor
- Request latency (p50, p95, p99)
- Error rate (< 1%)
- Request rate (RPS)
- Queue depths (Celery)
- Database connections
- Redis memory usage
- Certificate expiry

## Scaling Guidelines

### HPA Configuration
- **App**: CPU 70%, Memory 80%, min 3, max 20 replicas
- **Celery Workers**: CPU 60%, Memory 70%, min 2, max 10 replicas
- Scale-up: aggressive (100% CPU / 4 pods per 15s)
- Scale-down: conservative (10% per minute, 5min stabilization)

### Pod Disruption Budgets
- App: minAvailable 2
- Celery: minAvailable 1
- Nginx: minAvailable 1

## Backup & Recovery

### Database Backups
```bash
# Manual backup
kubectl exec -n vaceup postgres-0 -- pg_dump -U vaceup vaceup > backup_$(date +%Y%m%d).sql

# Automated (CronJob)
kubectl apply -f k8s/backup-cronjob.yaml
```

### Restore Procedure
```bash
kubectl exec -i -n vaceup postgres-0 -- psql -U vaceup -d vaceup < backup_20240101.sql
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Pods stuck in Pending | Resource quotas / PVC | Check quotas, PVC binding |
| CrashLoopBackOff | Config/Secret missing | Check secrets, logs |
| ImagePullBackOff | Image not found | Check registry, credentials |
| CrashLoopBackOff (celery) | Redis connection | Check Redis URL, network |
| 502 Bad Gateway | Nginx upstream | Check app pods, service |

### Debug Commands
```bash
# View logs
kubectl logs -n vaceup -l app=vaceup-app --tail=100 -f

# Describe pod
kubectl describe pod -n vaceup -l app=vaceup-app

# Exec into pod
kubectl exec -it -n vaceup <pod-name> -- /bin/bash

# Check events
kubectl get events -n vaceup --sort-by='.lastTimestamp'

# Check HPA
kubectl get hpa -n vaceup -w
```

## Rollback Procedure

```bash
# Rollback deployment
kubectl rollout undo deployment/vaceup-app -n vaceup

# Check rollout status
kubectl rollout status deployment/vaceup-app -n vaceup

# Rollback to specific revision
kubectl rollout undo deployment/vaceup-app -n vaceup --to-revision=3
```

## Security Checklist

- [ ] All secrets stored in Kubernetes Secrets (not ConfigMaps)
- [ ] Network policies applied
- [ ] Pod security standards enforced
- [ ] Non-root containers
- [ ] Read-only root filesystem
- [ ] Drop all capabilities
- [ ] Network policies applied
- [ ] TLS 1.2+ enforced
- [ ] HSTS enabled
- [ ] CSP headers configured
- [ ] Rate limiting configured
- [ ] Secrets rotated regularly
- [ ] Audit logging enabled

## Rollout Checklist

- [ ] All tests passing (106/106)
- [ ] Secrets updated with production values
- [ ] ConfigMaps reviewed
- [ ] Database migrations ready
- [ ] Static files collected
- [ ] SSL certificates provisioned
- [ ] DNS records updated
- [ ] Monitoring alerts configured
- [ ] Runbook updated
- [ ] Team notified

## Support Contacts

| Role | Contact |
|------|---------|
| Platform Team | platform@vaceup.ng |
| On-Call | oncall@vaceup.ng |
| Security | security@vaceup.ng |