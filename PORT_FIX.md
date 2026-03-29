# 🔧 PORT CONFIGURATION FIX

## Problem
```
TCP health check failed on port 8000
```

## Root Cause
- Koyeb health check mencoba port 8000
- Aplikasi berjalan di port 4555 (hardcoded di settings.json)
- Port mismatch → health check gagal

## Solution Applied ✅

### 1. Updated app.js
**Before:**
```javascript
const port = getSetting('server_port', 4555);
```

**After:**
```javascript
const port = process.env.PORT || getSetting('server_port', 4555);
```

✅ Sekarang app membaca PORT dari environment variable  
✅ Fallback ke settings.json jika PORT tidak ada

### 2. Updated Dockerfile
```dockerfile
# Expose port 8000 (Koyeb default)
EXPOSE 8000

# Set PORT environment variable
ENV PORT=8000
```

### 3. Updated .koyeb/app.yaml
```yaml
ports:
  - port: 8000  # Changed from 4555 to 8000
    protocol: http

env:
  - key: PORT
    value: "8000"

health_checks:
  - port: 8000  # Changed from 4555 to 8000
    path: /health
```

## How It Works Now

1. **Koyeb sets** `PORT=8000` environment variable
2. **App reads** `PORT` from environment
3. **App listens** on port 8000
4. **Health check** succeeds on port 8000

## Deployment Instructions

### If Already Deployed to Koyeb:
1. Go to Koyeb dashboard
2. Click **"Redeploy"**
3. Wait for build to complete
4. Health check will pass ✅

### If Deploying Fresh:
1. Create app in Koyeb
2. Select repository
3. Builder: Docker
4. **Port: 8000** ⚠️ Important!
5. Deploy

## Verification

After deployment, check:

```bash
# Health check should return 200
curl https://your-app.koyeb.app/health

# Expected response
{
  "status": "ok",
  "version": "1.0.0",
  "database": "MongoDB"
}
```

## Port Configuration Summary

| Environment | Port | Configuration |
|-------------|------|---------------|
| Koyeb (Production) | 8000 | Via PORT env var |
| Local Development | 4555 | Via settings.json |
| Docker Local | 8000 | Via Dockerfile ENV |

## Status

✅ **Fixed and ready for deployment**

All files updated and pushed to GitHub.
Ready to redeploy!
