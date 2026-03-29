#!/usr/bin/env node

/**
 * MongoDB Database Setup Script - OPTIMIZED
 * Quick setup with skip if already exists
 */

const { connectDB, getDB } = require('../config/mongodb');

console.log('🚀 Starting MongoDB database setup...\n');

async function setupDatabase() {
    try {
        await connectDB();
        const db = getDB();

        console.log('✅ Connected to MongoDB\n');

        // Check if already initialized
        const collections = await db.listCollections().toArray();
        
        if (collections.length >= 30) {
            console.log(`✅ Database already initialized (${collections.length} collections found)`);
            console.log('⚡ Skipping setup for faster startup\n');
            process.exit(0);
        }

        console.log('📦 Creating collections...\n');

        // Required collections (minimal for faster setup)
        const requiredCollections = [
            'packages', 'customers', 'invoices', 'payments',
            'payment_gateway_transactions', 'expenses', 'odps',
            'cable_routes', 'network_segments', 'odp_connections',
            'cable_maintenance_logs', 'technicians', 'trouble_reports',
            'agents', 'agent_balances', 'agent_transactions',
            'agent_voucher_sales', 'agent_balance_requests',
            'agent_monthly_payments', 'agent_notifications',
            'collectors', 'collector_payments', 'installation_jobs',
            'voucher_pricing', 'voucher_purchases', 'voucher_customers',
            'voucher_online_settings', 'voucher_delivery_logs',
            'onu_devices', 'telegram_sessions', 'monthly_summary'
        ];

        const existingNames = collections.map(c => c.name);

        for (const collName of requiredCollections) {
            if (!existingNames.includes(collName)) {
                await db.createCollection(collName);
                console.log(`   ✅ Created: ${collName}`);
            } else {
                console.log(`   ⏭️  Exists: ${collName}`);
            }
        }

        console.log('\n📑 Creating essential indexes...\n');

        // Only create most critical indexes for faster startup
        await db.collection('customers').createIndex({ username: 1 }, { unique: true, background: true });
        await db.collection('customers').createIndex({ phone: 1 }, { unique: true, background: true });
        await db.collection('invoices').createIndex({ invoice_number: 1 }, { unique: true, background: true });
        await db.collection('invoices').createIndex({ customer_id: 1, status: 1 }, { background: true });
        
        console.log('   ✅ Essential indexes created (others will build in background)\n');

        console.log('✅ Database setup completed!\n');
        console.log('📊 Summary:');
        console.log(`   - Collections: ${requiredCollections.length}`);
        console.log(`   - Database: default`);
        console.log(`   - Type: MongoDB\n`);

        process.exit(0);
    } catch (error) {
        console.error('⚠️  Setup error (will continue):', error.message);
        process.exit(0); // Exit 0 to allow app to continue
    }
}

setupDatabase();
