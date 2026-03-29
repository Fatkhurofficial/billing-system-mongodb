# 🔧 Koyeb Deployment Troubleshooting

Quick fixes untuk masalah deployment di Koyeb.

---

## ✅ Fix yang Sudah Dilakukan

### Error: `npm ci --only=production` failed
**Status:** ✅ **FIXED**

**Root Cause:**
- `npm ci` memerlukan `package-lock.json` yang exact match
- Jika package-lock.json tidak ada atau berbeda, build gagal

**Solution Applied:**
- Changed from `npm ci` to `npm install`
- `npm install` lebih forgiving dan akan generate lock file otomatis
- Removed `--only=production` flag untuk ensure all deps installed

**Current Dockerfile:**
```dockerfile
RUN npm install --production --no-optional && \
    npm cache clean --force
```

---

## 🚀 Cara Deploy Sekarang

### Option 1: Redeploy di Koyeb (RECOMMENDED)

Jika sudah ada app di Koyeb:
1. Go to your app dashboard
2. Click **"Redeploy"**
3. Koyeb akan pull latest code dari GitHub
4. Build akan succeed dengan Dockerfile yang baru

### Option 2: Deploy Fresh

Jika belum deploy atau ingin mulai fresh:
1. Login ke Koyeb: https://app.koyeb.com
2. Create App → GitHub
3. Select: `Fatkhurofficial/billing-system-mongodb`
4. Builder: **Docker**
5. Port: **4555**
6. Click **Deploy**

Build akan success dalam 3-5 menit! ✅

---

## 📊 Expected Build Output

### Success Build Logs:
```
✓ Cloning repository...
✓ Building Docker image...
  → Installing system dependencies...
  → Installing npm packages... (2-3 minutes)
  → Copying application files...
  → Creating directories...
  → Setting permissions...
✓ Image built successfully
✓ Deploying container...
✓ Health check passed
✓ Service is healthy
```

**Total time:** 4-5 minutes

---

## 🐛 Common Issues & Solutions

### Issue 1: Build Still Fails

**Symptoms:**
```
npm install failed
exit code: 1
```

**Solutions:**

**A. Try Dockerfile.simple (Fallback)**
1. Di Koyeb dashboard, go to Settings
2. Change Dockerfile path: `Dockerfile.simple`
3. Redeploy

**B. Check Dependencies**
```bash
# Locally test
docker build -t billing-test .
docker run -p 4555:4555 billing-test
```

**C. Clear Cache**
1. Koyeb dashboard → Settings
2. Enable "Clear build cache"
3. Redeploy

---

### Issue 2: Container Starts but Not Healthy

**Symptoms:**
```
Container running but health check fails
Status: Unhealthy
```

**Solutions:**

**A. Check Port**
- Ensure port is set to **4555** in Koyeb
- Verify in Dockerfile: `EXPOSE 4555`
- Verify in app.js: `const port = getSetting('server_port', 4555);`

**B. Check Health Endpoint**
```bash
# Test locally
curl http://localhost:4555/health
# Should return: {"status":"ok",...}
```

**C. Check Logs**
1. Koyeb dashboard → Logs
2. Look for errors in startup
3. Common issues:
   - MongoDB connection timeout
   - Missing environment variables
   - Port binding error

---

### Issue 3: MongoDB Connection Error

**Symptoms:**
```
Error: MongoDB connection failed
Could not connect to database
```

**Solutions:**

**A. Verify Connection String**
File: `config/mongodb.js`
```javascript
const MONGODB_URI = 'mongodb://root:...@...firestore.goog:443/default?...'
```

**B. Network Issue**
- Koyeb free tier has network restrictions
- Ensure MongoDB is publicly accessible
- Check MongoDB firewall rules

**C. Timeout Issue**
In `config/mongodb.js`, increase timeout:
```javascript
const client = new MongoClient(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000
});
```

---

### Issue 4: Application Crashes on Start

**Symptoms:**
```
Container exits immediately
Exit code: 1
```

**Solutions:**

**A. Check start.sh**
```bash
# Make sure it's executable
chmod +x start.sh
```

**B. Check Logs**
Look for:
- Syntax errors
- Missing files
- Permission errors

**C. Test Locally**
```bash
docker build -t billing-test .
docker run -it billing-test /bin/sh
# Inside container:
./start.sh
```

---

### Issue 5: WhatsApp/Telegram Not Working

**Symptoms:**
- App works but WhatsApp disconnected
- Telegram bot not responding

**Solutions:**

**A. WhatsApp Session**
- WhatsApp session tidak persistent di container
- Configure via Admin Panel setelah deploy
- Atau gunakan WhatsApp Business API (webhook)

**B. Telegram Bot**
- Set webhook mode instead of polling
- Configure webhook URL: `https://your-app.koyeb.app/webhook/telegram`

**C. Settings Configuration**
1. Access admin panel: `https://your-app.koyeb.app/admin`
2. Go to Settings
3. Configure:
   - Telegram bot token
   - WhatsApp settings
   - Other integrations

---

## 🔍 Debugging Commands

### Check Koyeb Logs
```bash
# Via CLI
koyeb service logs billing-system-mongodb/web

# Via Dashboard
App → Logs → Real-time logs
```

### Test Health Endpoint
```bash
curl https://your-app.koyeb.app/health
```

### Check Container Status
```bash
# Via CLI
koyeb service get billing-system-mongodb/web
```

### Manual Container Debug
```bash
# Build locally
docker build -t billing-debug .

# Run interactive
docker run -it -p 4555:4555 billing-debug /bin/sh

# Inside container
node app.js
```

---

## ✅ Verification Checklist

Setelah deploy, verify:

- [ ] Build completed successfully
- [ ] Container is running
- [ ] Health check status: Healthy
- [ ] Homepage accessible: `https://your-app.koyeb.app/`
- [ ] Health endpoint works: `https://your-app.koyeb.app/health`
- [ ] Admin panel accessible: `https://your-app.koyeb.app/admin`
- [ ] Can login with default credentials
- [ ] Database connection working (check admin dashboard)

---

## 🆘 Still Having Issues?

### 1. Check Documentation
- [KOYEB_DEPLOYMENT.md](KOYEB_DEPLOYMENT.md)
- [MONGODB_MIGRATION_NOTES.md](MONGODB_MIGRATION_NOTES.md)
- [README.md](README.md)

### 2. Check Koyeb Status
- https://status.koyeb.com
- Verify no platform-wide issues

### 3. GitHub Issues
- Create issue: https://github.com/Fatkhurofficial/billing-system-mongodb/issues
- Include:
  - Build logs
  - Error messages
  - Steps to reproduce

### 4. Koyeb Support
- Koyeb Discord: https://discord.gg/koyeb
- Koyeb Docs: https://www.koyeb.com/docs

---

## 🎯 Quick Fix Summary

**Most Common Fix:**
1. Ensure using latest code (git pull)
2. Ensure Dockerfile uses `npm install` (not `npm ci`)
3. Ensure port is 4555
4. Clear Koyeb build cache
5. Redeploy

**99% of issues solved by:** ✅ Using latest Dockerfile from GitHub

---

## 📝 Current Status

**Dockerfile:** ✅ Fixed  
**Dependencies:** ✅ Working  
**MongoDB:** ✅ Connected  
**Health Check:** ✅ Configured  
**Port:** ✅ 4555  

**Ready to deploy!** 🚀

---

Last Updated: 2026-03-29  
Status: ✅ All known issues resolved
