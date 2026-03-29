# 🚀 Koyeb Deployment Guide

Panduan lengkap untuk deploy Billing System MongoDB ke Koyeb.

---

## 📋 Prerequisites

1. ✅ GitHub repository: https://github.com/Fatkhurofficial/billing-system-mongodb
2. ✅ Akun Koyeb (gratis): https://app.koyeb.com/signup
3. ✅ Kode sudah ter-upload ke GitHub

---

## 🎯 Deployment Methods

### Method 1: Deploy via Web UI (Recommended)

#### Step 1: Login ke Koyeb
1. Buka https://app.koyeb.com
2. Login dengan akun Anda
3. Klik **"Create App"**

#### Step 2: Connect GitHub
1. Pilih **"GitHub"** sebagai sumber deployment
2. Klik **"Connect GitHub"**
3. Authorize Koyeb untuk akses repository Anda
4. Pilih repository: **`Fatkhurofficial/billing-system-mongodb`**
5. Branch: **`main`**

#### Step 3: Configure Build
1. **Builder:** Pilih **"Docker"** ✅
2. **Dockerfile path:** `Dockerfile` (default)
3. **Build context:** `/` (root)

#### Step 4: Configure Service
1. **Service name:** `billing-system` (atau nama lain)
2. **Port:** `4555` ⚠️ PENTING!
3. **Health check path:** `/health`

#### Step 5: Configure Instance
1. **Region:** Pilih yang terdekat (Frankfurt, Singapore, dll)
2. **Instance type:** 
   - Free tier: **Nano** (512MB RAM)
   - Paid: **Small** atau lebih besar

#### Step 6: Environment Variables (Optional)
Tidak perlu environment variables untuk database karena sudah hardcoded!

Tapi Anda bisa menambahkan:
```
NODE_ENV=production
PORT=4555
```

#### Step 7: Deploy!
1. Review semua konfigurasi
2. Klik **"Deploy"**
3. Tunggu proses build (3-5 menit)
4. Status akan berubah jadi **"Healthy"** ✅

---

### Method 2: Deploy via Koyeb CLI

#### Install Koyeb CLI
```bash
# macOS
brew install koyeb/tap/koyeb-cli

# Linux
curl -fsSL https://cli.koyeb.com/install.sh | sh

# Windows (PowerShell)
iwr https://cli.koyeb.com/install.ps1 -useb | iex
```

#### Login
```bash
koyeb login
```

#### Deploy
```bash
# Clone repository jika belum
git clone https://github.com/Fatkhurofficial/billing-system-mongodb.git
cd billing-system-mongodb

# Deploy menggunakan config file
koyeb app create billing-system-mongodb \
  --git github.com/Fatkhurofficial/billing-system-mongodb \
  --git-branch main \
  --builder docker \
  --dockerfile Dockerfile \
  --ports 4555:http \
  --routes /:4555 \
  --instance-type nano \
  --regions fra

# Atau menggunakan app.yaml
koyeb app init
koyeb app deploy
```

---

## 🔧 Configuration Details

### Dockerfile
Sudah dikonfigurasi dengan:
- ✅ Node.js 20 Alpine (lightweight)
- ✅ Production dependencies only
- ✅ MongoDB setup otomatis
- ✅ Health check endpoint
- ✅ Port 4555 exposed

### Health Check
Aplikasi memiliki endpoint `/health` yang mengembalikan:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "whatsapp": "disconnected",
  "database": "MongoDB"
}
```

### Port Configuration
⚠️ **PENTING:** Port HARUS `4555` karena dikonfigurasi di `app.js`

---

## 📊 Build Process

Saat deploy, Koyeb akan:

1. **Clone repository** dari GitHub
2. **Build Docker image:**
   ```
   - Install system dependencies
   - Install Node.js dependencies
   - Copy application files
   - Setup MongoDB collections
   - Configure health check
   ```
3. **Run container:**
   ```
   - Start app.js
   - Connect to MongoDB
   - Initialize WhatsApp (jika configured)
   - Initialize Telegram bot (jika configured)
   - Start Express server on port 4555
   ```
4. **Health check:**
   ```
   - Check /health endpoint
   - Verify app is running
   - Mark as "Healthy"
   ```

**Build time:** Sekitar 3-5 menit untuk pertama kali

---

## 🌐 Access Your Application

Setelah deploy berhasil, Anda akan mendapatkan URL:

```
https://billing-system-<random-id>.koyeb.app
```

### Access Points:
- **Homepage:** `https://your-app.koyeb.app/`
- **Admin Panel:** `https://your-app.koyeb.app/admin`
- **Customer Portal:** `https://your-app.koyeb.app/customer/login`
- **Health Check:** `https://your-app.koyeb.app/health`

### Default Login:
- **Username:** `admin`
- **Password:** `admin`

⚠️ **Ubah password segera setelah login pertama!**

---

## 🔄 Update & Redeploy

### Auto Deploy (Recommended)
Koyeb otomatis redeploy setiap kali ada push ke GitHub:

```bash
# Make changes locally
git add .
git commit -m "Update features"
git push origin main

# Koyeb automatically detects and redeploys!
```

### Manual Redeploy
Via Koyeb Dashboard:
1. Go to your app
2. Click **"Redeploy"**
3. Confirm

Via CLI:
```bash
koyeb app redeploy billing-system-mongodb
```

---

## 📈 Monitoring

### Via Koyeb Dashboard
- **Metrics:** CPU, Memory, Network usage
- **Logs:** Real-time application logs
- **Events:** Deployment events

### Via CLI
```bash
# View logs
koyeb service logs billing-system-mongodb/web

# View metrics
koyeb service get billing-system-mongodb/web

# List deployments
koyeb deployment list billing-system-mongodb
```

---

## 🐛 Troubleshooting

### Build Failed
**Penyebab umum:**
- Dockerfile syntax error
- Missing dependencies
- Port configuration salah

**Solusi:**
1. Check logs di Koyeb dashboard
2. Verify Dockerfile locally:
   ```bash
   docker build -t billing-test .
   docker run -p 4555:4555 billing-test
   ```

### App Not Healthy
**Penyebab:**
- Port tidak match (bukan 4555)
- Health check path salah
- MongoDB connection error

**Solusi:**
1. Check service logs
2. Verify `/health` endpoint accessible
3. Check MongoDB connection string

### WhatsApp/Telegram Not Working
**Penyebab:**
- Credentials belum dikonfigurasi di settings.json
- Session files tidak persistent

**Solusi:**
1. Configure di Admin Panel setelah deploy
2. Untuk production, gunakan webhook untuk WhatsApp
3. Untuk Telegram, gunakan webhook mode

---

## ⚙️ Custom Domain (Optional)

### Add Custom Domain
1. Go to app settings
2. Click **"Domains"**
3. Add your domain: `billing.yourdomain.com`
4. Update DNS records:
   ```
   Type: CNAME
   Name: billing
   Value: <your-koyeb-url>
   ```
5. Wait for DNS propagation (5-30 minutes)

---

## 💰 Pricing

### Free Tier
- ✅ **Nano instance:** 512 MB RAM
- ✅ **100 GB bandwidth/month**
- ✅ **Unlimited apps**
- ✅ **SSL certificates included**

### Paid Tier (if needed)
- **Small:** $5.37/month - 1 GB RAM
- **Medium:** $10.74/month - 2 GB RAM
- **Large:** $21.48/month - 4 GB RAM

Untuk aplikasi billing dengan traffic sedang, **Nano (Free)** atau **Small** sudah cukup.

---

## 📋 Checklist Deployment

Sebelum deploy, pastikan:

- [x] Repository sudah di GitHub
- [x] Dockerfile sudah ada dan valid
- [x] .dockerignore sudah dikonfigurasi
- [x] MongoDB connection sudah hardcoded
- [x] Port set ke 4555
- [x] Health check endpoint `/health` working
- [x] package.json dependencies complete
- [x] settings.json dikonfigurasi (atau nanti via admin panel)

---

## 🎯 Post-Deployment

Setelah deploy berhasil:

1. **Access admin panel:** `https://your-app.koyeb.app/admin`
2. **Login dengan default credentials**
3. **Ubah password admin**
4. **Configure settings:**
   - Company information
   - WhatsApp settings (jika perlu)
   - Telegram bot token (jika perlu)
   - Mikrotik credentials (jika perlu)
   - Payment gateway credentials
5. **Create packages**
6. **Add customers**
7. **Test billing flow**

---

## 📞 Support

**Koyeb Documentation:** https://www.koyeb.com/docs

**Issues:** https://github.com/Fatkhurofficial/billing-system-mongodb/issues

**Community:** Koyeb Discord

---

## ✅ Summary

**Deployment Steps:**
1. Login ke Koyeb
2. Connect GitHub repository
3. Configure Docker build
4. Set port to 4555
5. Deploy!

**Build time:** 3-5 minutes  
**Access:** `https://<your-app>.koyeb.app`  
**Status:** Auto health-checked  

**🎉 SIAP PRODUCTION!**
