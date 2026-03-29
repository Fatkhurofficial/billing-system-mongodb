// Database Migration Script - Add WhatsApp LID Support
// MongoDB version - ensures whatsapp_lid field and index exist

const { connectDB, getDB } = require('./config/mongodb');

console.log('🔄 Starting database migration for WhatsApp LID...\n');

async function migrate() {
    try {
        await connectDB();
        const db = getDB();

        console.log('✅ Connected to MongoDB');

        // Step 1: Create unique index for whatsapp_lid (if not exists)
        await db.collection('customers').createIndex(
            { whatsapp_lid: 1 },
            { unique: true, sparse: true }
        );

        console.log('✅ Unique index for whatsapp_lid created/verified');

        // Step 2: Verify migration
        const indexInfo = await db.collection('customers').indexes();
        const hasWhatsAppLidIndex = indexInfo.some(idx => idx.name.includes('whatsapp_lid'));

        if (hasWhatsAppLidIndex) {
            console.log('✅ WhatsApp LID index verified');
        } else {
            console.log('⚠️  WhatsApp LID index may not have been created properly');
        }

        // Step 3: Count customers with whatsapp_lid
        const customersWithLid = await db.collection('customers').countDocuments({
            whatsapp_lid: { $exists: true, $ne: null }
        });

        console.log(`\n📊 Migration Summary:`);
        console.log(`   - Customers with WhatsApp LID: ${customersWithLid}`);

        const totalCustomers = await db.collection('customers').countDocuments({});
        console.log(`   - Total customers: ${totalCustomers}`);
        console.log(`   - Customers without LID: ${totalCustomers - customersWithLid}`);

        console.log('\n✅ Migration completed successfully!');
        console.log('\nℹ️  Note: WhatsApp LID will be populated automatically when customers interact via WhatsApp');

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
