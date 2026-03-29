const express = require('express');
const path = require('path');
const axios = require('axios');
const logger = require('./config/logger');
const whatsapp = require('./config/whatsapp');
const { monitorPPPoEConnections } = require('./config/mikrotik');
const fs = require('fs');
const session = require('express-session');
const { getSetting } = require('./config/settingsManager');
const { connectDB, getDB } = require('./config/mongodb');

// Import invoice scheduler
const invoiceScheduler = require('./config/scheduler');

// Import technician sync service for hot-reload (MONGODB VERSION)
const technicianSync = {
    async start() {
        const fs = require('fs');
        const { getSettingsWithCache } = require('./config/settingsManager');

        // Wait for MongoDB connection
        await connectDB();
        const db = getDB();

        const sync = async () => {
            try {
                const settings = getSettingsWithCache();
                const techNumbers = Object.keys(settings).filter(k => k.startsWith('technician_numbers.'));
                
                for (const k of techNumbers) {
                    const phone = settings[k];
                    if (phone) {
                        await db.collection('technicians').updateOne(
                            { phone: phone },
                            {
                                $setOnInsert: {
                                    phone: phone,
                                    name: `Teknisi ${phone.slice(-4)}`,
                                    role: 'technician',
                                    is_active: true,
                                    created_at: new Date()
                                }
                            },
                            { upsert: true }
                        );
                    }
                }
                console.log('📱 Technician numbers synced from settings.json');
            } catch (e) {
                console.error('Sync error:', e.message);
            }
        };

        fs.watchFile('settings.json', { interval: 1000 }, sync);
        await sync(); // Initial sync
        console.log('🔄 Technician auto-sync enabled - settings.json changes will auto-update technicians');
    }
};

// Start technician sync service
technicianSync.start().catch(err => {
    console.error('Error starting technician sync:', err);
});

// Inisialisasi aplikasi Express
const app = express();

// Import route adminAuth
const { router: adminAuthRouter, adminAuth } = require('./routes/adminAuth');

// Import middleware untuk access control (harus diimport sebelum digunakan)
const { blockTechnicianAccess } = require('./middleware/technicianAccessControl');

// Middleware dasar - Optimized
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files dengan cache
app.use('/public', express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    etag: true
}));
app.use(session({
    secret: 'rahasia-portal-anda',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true
    },
    name: 'admin_session'
}));

// Test route untuk debugging
app.get('/admin/test', (req, res) => {
    res.json({ message: 'Admin routes working!', timestamp: new Date().toISOString() });
});

// Gunakan route adminAuth untuk /admin
app.use('/admin', adminAuthRouter);

// Import dan gunakan route adminDashboard
const adminDashboardRouter = require('./routes/adminDashboard');
app.use('/admin', blockTechnicianAccess, adminDashboardRouter);

// Import dan gunakan route adminGenieacs
const adminGenieacsRouter = require('./routes/adminGenieacs');
app.use('/admin', blockTechnicianAccess, adminGenieacsRouter);

// Import dan gunakan route adminMappingNew
const adminMappingNewRouter = require('./routes/adminMappingNew');
app.use('/admin', blockTechnicianAccess, adminMappingNewRouter);

// Import dan gunakan route adminMikrotik
const adminMikrotikRouter = require('./routes/adminMikrotik');
app.use('/admin', blockTechnicianAccess, adminMikrotikRouter);

// Import dan gunakan route adminHotspot
const adminHotspotRouter = require('./routes/adminHotspot');
app.use('/admin/hotspot', blockTechnicianAccess, adminHotspotRouter);

// Import dan gunakan route adminSetting
const { router: adminSettingRouter } = require('./routes/adminSetting');
app.use('/admin/settings', blockTechnicianAccess, adminAuth, adminSettingRouter);

// Import dan gunakan route adminUpdate
const adminUpdateRouter = require('./routes/adminUpdate');
app.use('/admin/update', blockTechnicianAccess, adminAuth, adminUpdateRouter);

// Import dan gunakan route configValidation
const configValidationRouter = require('./routes/configValidation');
app.use('/admin/config', blockTechnicianAccess, configValidationRouter);

// Import dan gunakan route adminTroubleReport
const adminTroubleReportRouter = require('./routes/adminTroubleReport');
app.use('/admin/trouble', blockTechnicianAccess, adminAuth, adminTroubleReportRouter);

// Import dan gunakan route adminBilling
const adminBillingRouter = require('./routes/adminBilling');
app.use('/admin/billing', blockTechnicianAccess, adminAuth, adminBillingRouter);

// Import dan gunakan route adminInstallationJobs
const adminInstallationJobsRouter = require('./routes/adminInstallationJobs');
app.use('/admin/installations', blockTechnicianAccess, adminAuth, adminInstallationJobsRouter);

// Import dan gunakan route adminTechnicians
const adminTechniciansRouter = require('./routes/adminTechnicians');
app.use('/admin/technicians', blockTechnicianAccess, adminAuth, adminTechniciansRouter);

// Import dan gunakan route agentAuth
const { router: agentAuthRouter } = require('./routes/agentAuth');
app.use('/agent', agentAuthRouter);

// Import dan gunakan route agent
const agentRouter = require('./routes/agent');
app.use('/agent', agentRouter);

// Import dan gunakan route adminAgents
const adminAgentsRouter = require('./routes/adminAgents');
app.use('/admin', blockTechnicianAccess, adminAuth, adminAgentsRouter);

// Import dan gunakan route adminVoucherPricing
const adminVoucherPricingRouter = require('./routes/adminVoucherPricing');
app.use('/admin/voucher-pricing', blockTechnicianAccess, adminAuth, adminVoucherPricingRouter);

// Import dan gunakan route adminCableNetwork
const adminCableNetworkRouter = require('./routes/adminCableNetwork');
app.use('/admin/cable-network', blockTechnicianAccess, adminAuth, adminCableNetworkRouter);

// Import dan gunakan route adminCollectors
const adminCollectorsRouter = require('./routes/adminCollectors');
app.use('/admin/collectors', blockTechnicianAccess, adminCollectorsRouter);

// Import dan gunakan route cache management
const cacheManagementRouter = require('./routes/cacheManagement');
app.use('/admin/cache', blockTechnicianAccess, cacheManagementRouter);

// Import dan gunakan route payment
const paymentRouter = require('./routes/payment');
app.use('/payment', paymentRouter);

// Import dan gunakan route testTroubleReport untuk debugging
const testTroubleReportRouter = require('./routes/testTroubleReport');
app.use('/test/trouble', testTroubleReportRouter);

// Import dan gunakan route trouble report untuk pelanggan
const troubleReportRouter = require('./routes/troubleReport');
app.use('/customer/trouble', troubleReportRouter);

// Import dan gunakan route voucher publik
const { router: publicVoucherRouter } = require('./routes/publicVoucher');
app.use('/voucher', publicVoucherRouter);

// Import dan gunakan route public tools
const publicToolsRouter = require('./routes/publicTools');
app.use('/tools', publicToolsRouter);

// Tambahkan webhook endpoint untuk voucher payment
app.use('/webhook/voucher', publicVoucherRouter);

// Import dan gunakan route API dashboard traffic
const apiDashboardRouter = require('./routes/apiDashboard');
app.use('/api', apiDashboardRouter);

// Konstanta
const VERSION = '1.0.0';

// Variabel global untuk menyimpan status koneksi WhatsApp
global.whatsappStatus = {
    connected: false,
    qrCode: null,
    phoneNumber: null,
    connectedSince: null,
    status: 'disconnected'
};

// Pastikan direktori sesi WhatsApp ada
const sessionDir = getSetting('whatsapp_session_path', './whatsapp-session');
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
    logger.info(`Direktori sesi WhatsApp dibuat: ${sessionDir}`);
}

// Route untuk health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: VERSION,
        whatsapp: global.whatsappStatus.status,
        database: 'MongoDB'
    });
});

// Route untuk mendapatkan status WhatsApp
app.get('/whatsapp/status', (req, res) => {
    res.json({
        status: global.whatsappStatus.status,
        connected: global.whatsappStatus.connected,
        phoneNumber: global.whatsappStatus.phoneNumber,
        connectedSince: global.whatsappStatus.connectedSince
    });
});

// Redirect root ke portal pelanggan
app.get('/', (req, res) => {
    res.redirect('/customer/login');
});

// Import PPPoE monitoring modules
const pppoeMonitor = require('./config/pppoe-monitor');
const pppoeCommands = require('./config/pppoe-commands');

// Import GenieACS commands module
const genieacsCommands = require('./config/genieacs-commands');

// Import MikroTik commands module
const mikrotikCommands = require('./config/mikrotik-commands');

// Import RX Power Monitor module
const rxPowerMonitor = require('./config/rxPowerMonitor');

// Tambahkan view engine dan static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Placeholder icons
try {
    const staticIcons = require('./routes/staticIcons');
    app.use('/', staticIcons);
} catch (e) {
    logger.warn('staticIcons route not loaded:', e.message);
}

// Mount customer portal
const customerPortal = require('./routes/customerPortal');
app.use('/customer', customerPortal);

// Mount customer billing portal
const customerBillingRouter = require('./routes/customerBilling');
app.use('/customer/billing', customerBillingRouter);

// Import dan gunakan route teknisi portal
const { router: technicianAuthRouter } = require('./routes/technicianAuth');
app.use('/technician', technicianAuthRouter);
app.use('/teknisi', technicianAuthRouter);

// Import dan gunakan route dashboard teknisi
const technicianDashboardRouter = require('./routes/technicianDashboard');
app.use('/technician', technicianDashboardRouter);
app.use('/teknisi', technicianDashboardRouter);

// Import dan gunakan route technician cable network
const technicianCableNetworkRouter = require('./routes/technicianCableNetwork');
app.use('/technician', technicianCableNetworkRouter);
app.use('/teknisi', technicianCableNetworkRouter);

// Halaman Isolir
app.get('/isolir', async (req, res) => {
    try {
        const { getSettingsWithCache, getSetting } = require('./config/settingsManager');
        const billingManager = require('./config/billing');

        const settings = getSettingsWithCache();
        const companyHeader = getSetting('company_header', 'GEMBOK');
        const adminWA = getSetting('admins.0', '6281234567890');
        const adminDisplay = adminWA && adminWA.startsWith('62') ? ('0' + adminWA.slice(2)) : (adminWA || '-');

        let customerName = (req.query.nama || req.query.name || '').toString().trim();
        if (!customerName) {
            const sessionUsername = req.session && (req.session.customer_username || req.session.username);
            if (sessionUsername) {
                try {
                    const c = await billingManager.getCustomerByUsername(sessionUsername);
                    if (c && c.name) customerName = c.name;
                } catch { }
            }
        }
        if (!customerName) {
            const qUser = (req.query.pppoe || req.query.username || '').toString().trim();
            if (qUser) {
                try {
                    const c = await billingManager.getCustomerByPPPoE(qUser);
                    if (c && c.name) customerName = c.name;
                } catch { }
            }
        }
        if (!customerName) {
            const qPhone = (req.query.phone || req.query.nohp || '').toString().trim();
            if (qPhone) {
                try {
                    const c = await billingManager.getCustomerByPhone(qPhone);
                    if (c && c.name) customerName = c.name;
                } catch { }
            }
        }
        if (!customerName) customerName = 'Pelanggan';

        const logoFile = settings.logo_filename || 'logo.png';
        const logoPath = `/public/img/${logoFile}`;
        const paymentAccounts = settings.payment_accounts || {};

        res.render('isolir', {
            companyHeader,
            adminWA,
            adminDisplay,
            customerName: customerName.slice(0, 64),
            logoPath,
            paymentAccounts,
            encodeURIComponent
        });
    } catch (error) {
        console.error('Error rendering isolir page:', error);
        res.status(500).send('Gagal memuat halaman isolir');
    }
});

// Import dan gunakan route tukang tagih (collector)
const { router: collectorAuthRouter } = require('./routes/collectorAuth');
app.use('/collector', collectorAuthRouter);

// Import dan gunakan route dashboard tukang tagih
const collectorDashboardRouter = require('./routes/collectorDashboard');
app.use('/collector', collectorDashboardRouter);

// Import dan gunakan route cek update
const versionCheckRouter = require('./routes/versionCheck');
app.use('/api/version', versionCheckRouter);

// Inisialisasi scheduled tasks
const scheduledTasks = require('./config/scheduledTasks');

// Inisialisasi WhatsApp dan PPPoE monitoring
try {
    whatsapp.connectToWhatsApp().then(sock => {
        if (sock) {
            whatsapp.setSock(sock);
            global.whatsappSocket = sock;
            global.getWhatsAppSocket = () => sock;

            pppoeMonitor.setSock(sock);

            const AgentWhatsAppIntegration = require('./config/agentWhatsAppIntegration');
            const agentWhatsApp = new AgentWhatsAppIntegration(whatsapp);
            agentWhatsApp.initialize();

            console.log('🤖 Agent WhatsApp Commands initialized');
            pppoeCommands.setSock(sock);
            genieacsCommands.setSock(sock);
            mikrotikCommands.setSock(sock);
            rxPowerMonitor.setSock(sock);

            const troubleReport = require('./config/troubleReport');
            troubleReport.setSockInstance(sock);

            scheduledTasks.initialize();

            const initAgentTables = async () => {
                try {
                    const AgentManager = require('./config/agentManager');
                    const agentManager = new AgentManager();
                    console.log('✅ Agent tables created/verified by AgentManager');
                } catch (error) {
                    console.error('Error initializing agent tables:', error);
                }
            };

            initAgentTables().then(() => {
                console.log('Database initialization completed successfully');
            }).catch((err) => {
                console.error('Database initialization failed:', err);
            });

            if (getSetting('mikrotik_host') && getSetting('mikrotik_user') && getSetting('mikrotik_password')) {
                pppoeMonitor.initializePPPoEMonitoring().then(() => {
                    logger.info('PPPoE monitoring initialized');
                }).catch((err) => {
                    logger.error('Error initializing PPPoE monitoring:', err);
                });
            }

            try {
                const intervalManager = require('./config/intervalManager');
                intervalManager.initialize();
                logger.info('Interval Manager initialized with all monitoring systems');
            } catch (err) {
                logger.error('Error initializing Interval Manager:', err);
            }
        }
    }).catch(err => {
        logger.error('Error connecting to WhatsApp:', err);
    });

    if (getSetting('mikrotik_host') && getSetting('mikrotik_user') && getSetting('mikrotik_password')) {
        monitorPPPoEConnections().catch(err => {
            logger.error('Error starting legacy PPPoE monitoring:', err);
        });
    }
} catch (error) {
    logger.error('Error initializing services:', error);
}

// Initialize Telegram Bot
try {
    const telegramBot = require('./config/telegramBot');
    telegramBot.start().then(() => {
        logger.info('Telegram bot initialization completed');
    }).catch(err => {
        logger.error('Error starting Telegram bot:', err);
    });
} catch (error) {
    logger.error('Error initializing Telegram bot:', error);
}

const RECONNECT_DELAY = 30000;

function startServer(portToUse) {
    const port = parseInt(portToUse);
    if (isNaN(port) || port < 1 || port > 65535) {
        logger.error(`Port tidak valid: ${portToUse}`);
        process.exit(1);
    }

    logger.info(`Memulai server pada port yang dikonfigurasi: ${port}`);

    try {
        const server = app.listen(port, () => {
            logger.info(`✅ Server berhasil berjalan pada port ${port}`);
            logger.info(`🌐 Web Portal tersedia di: http://localhost:${port}`);
            logger.info(`Database: MongoDB`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.error(`❌ ERROR: Port ${port} sudah digunakan!`);
                logger.error(`💡 Solusi: Hentikan aplikasi yang menggunakan port ${port} atau ubah port di settings.json`);
            } else {
                logger.error('❌ Error starting server:', err.message);
            }
            process.exit(1);
        });
    } catch (error) {
        logger.error(`❌ Terjadi kesalahan saat memulai server:`, error.message);
        process.exit(1);
    }
}

const port = getSetting('server_port', 4555);
logger.info(`Attempting to start server on configured port: ${port}`);
startServer(port);

const { addCustomerTag } = require('./config/customerTag');

module.exports = app;
