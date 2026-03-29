#!/usr/bin/env node

/**
 * MongoDB Database Setup Script
 * Initializes all collections and indexes for Gembok Bill
 */

const { connectDB, getDB } = require('../config/mongodb');

console.log('🚀 Starting MongoDB database setup...\n');

async function setupDatabase() {
    try {
        await connectDB();
        const db = getDB();

        console.log('✅ Connected to MongoDB\n');

        // Collections to create
        const collections = [
            'packages',
            'customers',
            'invoices',
            'payments',
            'payment_gateway_transactions',
            'expenses',
            'odps',
            'cable_routes',
            'network_segments',
            'odp_connections',
            'cable_maintenance_logs',
            'technicians',
            'trouble_reports',
            'agents',
            'agent_balances',
            'agent_transactions',
            'agent_voucher_sales',
            'agent_balance_requests',
            'agent_monthly_payments',
            'agent_notifications',
            'collectors',
            'collector_payments',
            'installation_jobs',
            'voucher_pricing',
            'voucher_purchases',
            'voucher_customers',
            'voucher_online_settings',
            'voucher_delivery_logs',
            'onu_devices',
            'telegram_sessions',
            'monthly_summary'
        ];

        const existingCollections = await db.listCollections().toArray();
        const existingNames = existingCollections.map(c => c.name);

        console.log('📦 Creating collections...\n');

        for (const collName of collections) {
            if (!existingNames.includes(collName)) {
                await db.createCollection(collName);
                console.log(`   ✅ Created: ${collName}`);
            } else {
                console.log(`   ⏭️  Exists: ${collName}`);
            }
        }

        console.log('\n📑 Creating indexes...\n');

        // Customers indexes
        await db.collection('customers').createIndex({ username: 1 }, { unique: true });
        await db.collection('customers').createIndex({ phone: 1 }, { unique: true });
        await db.collection('customers').createIndex({ pppoe_username: 1 });
        await db.collection('customers').createIndex({ whatsapp_lid: 1 }, { sparse: true, unique: true });
        await db.collection('customers').createIndex({ package_id: 1 });
        await db.collection('customers').createIndex({ status: 1 });
        console.log('   ✅ Customers indexes created');

        // Invoices indexes
        await db.collection('invoices').createIndex({ invoice_number: 1 }, { unique: true });
        await db.collection('invoices').createIndex({ customer_id: 1 });
        await db.collection('invoices').createIndex({ status: 1 });
        await db.collection('invoices').createIndex({ due_date: 1 });
        console.log('   ✅ Invoices indexes created');

        // Packages indexes
        await db.collection('packages').createIndex({ name: 1 });
        await db.collection('packages').createIndex({ is_active: 1 });
        console.log('   ✅ Packages indexes created');

        // Payments indexes
        await db.collection('payments').createIndex({ invoice_id: 1 });
        await db.collection('payments').createIndex({ payment_date: 1 });
        console.log('   ✅ Payments indexes created');

        // ODPs indexes
        await db.collection('odps').createIndex({ code: 1 }, { unique: true });
        await db.collection('odps').createIndex({ name: 1 }, { unique: true });
        await db.collection('odps').createIndex({ latitude: 1, longitude: 1 });
        await db.collection('odps').createIndex({ status: 1 });
        console.log('   ✅ ODPs indexes created');

        // Cable routes indexes
        await db.collection('cable_routes').createIndex({ customer_id: 1 });
        await db.collection('cable_routes').createIndex({ odp_id: 1 });
        await db.collection('cable_routes').createIndex({ status: 1 });
        console.log('   ✅ Cable routes indexes created');

        // Technicians indexes
        await db.collection('technicians').createIndex({ phone: 1 }, { unique: true });
        await db.collection('technicians').createIndex({ is_active: 1 });
        console.log('   ✅ Technicians indexes created');

        // Trouble reports indexes
        await db.collection('trouble_reports').createIndex({ customer_id: 1 });
        await db.collection('trouble_reports').createIndex({ status: 1 });
        await db.collection('trouble_reports').createIndex({ created_at: -1 });
        console.log('   ✅ Trouble reports indexes created');

        // Agents indexes
        await db.collection('agents').createIndex({ username: 1 }, { unique: true });
        await db.collection('agents').createIndex({ phone: 1 }, { unique: true });
        await db.collection('agents').createIndex({ status: 1 });
        console.log('   ✅ Agents indexes created');

        // Collectors indexes
        await db.collection('collectors').createIndex({ phone: 1 }, { unique: true });
        await db.collection('collectors').createIndex({ status: 1 });
        console.log('   ✅ Collectors indexes created');

        // Voucher indexes
        await db.collection('voucher_purchases').createIndex({ voucher_code: 1 }, { unique: true });
        await db.collection('voucher_purchases').createIndex({ status: 1 });
        console.log('   ✅ Voucher indexes created');

        // ONU devices indexes
        await db.collection('onu_devices').createIndex({ serial_number: 1 }, { unique: true });
        console.log('   ✅ ONU devices indexes created');

        // Telegram sessions indexes
        await db.collection('telegram_sessions').createIndex({ chat_id: 1 }, { unique: true });
        await db.collection('telegram_sessions').createIndex({ expires_at: 1 });
        console.log('   ✅ Telegram sessions indexes created');

        console.log('\n✅ Database setup completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - Total collections: ${collections.length}`);
        console.log(`   - Database: default`);
        console.log(`   - Type: MongoDB\n`);

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Database setup failed:', error);
        process.exit(1);
    }
}

setupDatabase();
