const { connectDB, getDB } = require('./config/mongodb');

const collectorId = '3'; // MongoDB uses string IDs

async function verifyStats() {
    await connectDB();
    const db = getDB();

    console.log(`Checking stats for collector ID ${collectorId}...`);

    try {
        // Today's payments
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayPayments = await db.collection('collector_payments').aggregate([
            {
                $match: {
                    collector_id: collectorId,
                    collected_at: { $gte: today, $lt: tomorrow },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$payment_amount' }
                }
            }
        ]).toArray();

        console.log("Today Payments:", todayPayments.length > 0 ? todayPayments[0].total : 0);

        // Total commission this month
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        const totalCommission = await db.collection('collector_payments').aggregate([
            {
                $match: {
                    collector_id: collectorId,
                    collected_at: { $gte: startOfMonth, $lte: endOfMonth },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$commission_amount' }
                }
            }
        ]).toArray();

        console.log("Total Commission:", totalCommission.length > 0 ? totalCommission[0].total : 0);

        // Total payments count this month
        const totalCount = await db.collection('collector_payments').countDocuments({
            collector_id: collectorId,
            collected_at: { $gte: startOfMonth, $lte: endOfMonth },
            status: 'completed'
        });

        console.log("Total Payments Count:", totalCount);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

verifyStats();
