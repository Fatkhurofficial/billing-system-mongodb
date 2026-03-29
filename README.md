# 🌐 ISP Billing System - MongoDB Edition

> **Sistem manajemen billing ISP yang lengkap dengan integrasi WhatsApp, Telegram, Mikrotik, dan GenieACS. Direfactor dari SQLite/MySQL ke MongoDB untuk deployment modern.**

[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-green.svg)](https://www.mongodb.com/)
[![Node.js](https://img.shields.io/badge/Node.js-14+-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Deploy Ready](https://img.shields.io/badge/deploy-ready-success.svg)](https://koyeb.com)

---

## ✨ Highlights

✅ **Fully Refactored to MongoDB** - No SQLite/MySQL dependencies  
✅ **Cloud-Ready** - Optimized for Koyeb, Railway, Render  
✅ **30+ Collections** - Complete billing system with indexes  
✅ **WhatsApp Integration** - Baileys library for customer communication  
✅ **Telegram Bot** - Admin commands and notifications  
✅ **Mikrotik Integration** - PPPoE monitoring and management  
✅ **GenieACS Integration** - ONT/ONU device management  
✅ **Payment Gateway** - Midtrans, Xendit support  
✅ **Cable Network Management** - ODP tracking and mapping  

---

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ installed
- MongoDB database (connection provided)
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/Fatkhurofficial/billing-system-mongodb.git
cd billing-system-mongodb

# Install dependencies
npm install

# Setup database (creates collections and indexes)
npm run setup

# Start application
npm start
```

Application will run on **port 4555**

---

## 📦 Features

### 💰 Billing Management
- Package management with custom pricing
- Automatic invoice generation
- Payment tracking and history
- Multiple payment gateways (Midtrans, Xendit)
- Tax calculation
- Payment reminders via WhatsApp

### 👥 Customer Management
- Customer registration and profiles
- Service activation/suspension
- Billing day customization
- Payment history
- Service usage monitoring
- WhatsApp integration for notifications

### 📱 Multi-Platform Support
- **Admin Portal** - Full-featured web dashboard
- **Customer Portal** - Self-service portal
- **Technician Portal** - Field technician tools
- **Collector Portal** - Payment collection tracking
- **Agent System** - Reseller management
- **Mobile Responsive** - Works on all devices

### 🔧 Network Management
- **Mikrotik PPPoE** - Connection monitoring
- **GenieACS** - ONT/ONU device management
- **Static IP** - IP address management
- **Cable Network** - ODP and cable route tracking
- **Network Segments** - Geographic network mapping
- **RX Power Monitoring** - Signal quality tracking

### 💬 Communication
- **WhatsApp Bot** - Automated customer service
- **Telegram Bot** - Admin notifications and commands
- **Payment Notifications** - Automatic reminders
- **Service Notifications** - Connection status alerts

### 📊 Reports & Analytics
- Monthly revenue reports
- Payment collection reports
- Customer growth analytics
- Service usage statistics
- Financial summaries
- Export to Excel

---

## 🗄️ Database Structure

### Core Collections
- `packages` - Internet packages and pricing
- `customers` - Customer information
- `invoices` - Billing invoices
- `payments` - Payment records
- `expenses` - Expense tracking

### Network Infrastructure
- `odps` - Optical Distribution Points
- `cable_routes` - Cable routing
- `network_segments` - Network mapping
- `onu_devices` - ONU device registry

### Operations
- `technicians` - Field technicians
- `trouble_reports` - Customer complaints
- `installation_jobs` - Installation tracking
- `collectors` - Payment collectors
- `agents` - Reseller agents

**Total: 30+ collections** with optimized indexes

---

## 🌍 Deployment

### Deploy to Koyeb (Recommended)

1. Fork this repository
2. Sign up at [Koyeb](https://koyeb.com)
3. Create new app from GitHub
4. Configure:
   - **Build Command:** `npm install && npm run setup`
   - **Run Command:** `npm start`
   - **Port:** 4555
5. Deploy!

### Deploy to Railway

1. Sign up at [Railway](https://railway.app)
2. New Project → Deploy from GitHub
3. Select this repository
4. Railway auto-detects settings
5. Deploy!

### Deploy to Render

1. Sign up at [Render](https://render.com)
2. New Web Service
3. Connect GitHub repository
4. Configure:
   - **Build Command:** `npm install && npm run setup`
   - **Start Command:** `npm start`
5. Deploy!

---

## ⚙️ Configuration

### MongoDB Connection
MongoDB connection is pre-configured in `config/mongodb.js` with:
- Database: `default`
- Connection: Hardcoded (secure cloud MongoDB)

### Application Settings
Edit `settings.json` for:
- Company information
- Payment gateway credentials
- WhatsApp settings
- Telegram bot token
- Mikrotik credentials
- GenieACS endpoint

---

## 📖 Documentation

Comprehensive documentation available:

- **[MONGODB_MIGRATION_NOTES.md](MONGODB_MIGRATION_NOTES.md)** - Complete migration guide
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Deployment instructions
- **[API Documentation](docs/)** - API reference
- **[User Guides](docs/)** - Feature documentation

---

## 🔐 Default Credentials

**Admin Panel:** `/admin`
- Username: `admin`
- Password: `admin`

**Note:** Change default credentials immediately after first login!

---

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database (via mongodb driver)
- **Baileys** - WhatsApp integration
- **Telegraf** - Telegram bot framework
- **Axios** - HTTP client

### Frontend
- **EJS** - Template engine
- **Tailwind CSS** - Styling
- **JavaScript** - Client-side logic
- **Leaflet** - Network mapping

### Integrations
- **Mikrotik RouterOS API** - Network management
- **GenieACS** - TR-069 device management
- **Midtrans** - Payment gateway
- **Xendit** - Payment gateway

---

## 📁 Project Structure

```
billing-system-mongodb/
├── config/              # Configuration files
│   ├── mongodb.js      # MongoDB connection
│   ├── billing.js      # Billing operations
│   ├── whatsapp.js     # WhatsApp integration
│   └── ...
├── routes/             # Express routes
├── views/              # EJS templates
├── public/             # Static assets
├── scripts/            # Utility scripts
├── middleware/         # Express middleware
├── utils/              # Helper functions
├── app.js              # Main application
└── package.json        # Dependencies
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📝 License

This project is licensed under the ISC License.

---

## 🙋 Support

For questions or issues:

1. Check [Documentation](docs/)
2. Open an [Issue](https://github.com/Fatkhurofficial/billing-system-mongodb/issues)
3. Contact: [GitHub Profile](https://github.com/Fatkhurofficial)

---

## 🎯 Roadmap

- [x] MongoDB migration complete
- [x] Koyeb deployment ready
- [ ] Docker support
- [ ] API documentation
- [ ] Unit tests
- [ ] Mobile app (React Native)
- [ ] Multi-language support

---

## ⭐ Show Your Support

If you find this project useful, please give it a ⭐ on GitHub!

---

## 📊 Stats

- **30+ Collections** with optimized indexes
- **569 Files** in codebase
- **200,000+ Lines** of code
- **50+ API Endpoints**
- **10+ Integrations**

---

**Built with ❤️ for ISP businesses**

**Ready for production deployment on Koyeb, Railway, or Render!** 🚀
