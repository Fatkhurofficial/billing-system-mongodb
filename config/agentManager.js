const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const { getSettingsWithCache } = require('./settingsManager');
const logger = require('./logger');
const { connectDB, getDB } = require('./mongodb');

class AgentManager {
    constructor() {
        this.db = null;
        this.initDatabase();
    }

    async initDatabase() {
        try {
            this.db = await connectDB();
            await this.createCollections();
            await this.createIndexes();
            console.log('✅ Agent system initialized (MongoDB)');
        } catch (err) {
            console.error('Error initializing agent system:', err);
        }
    }

    async createCollections() {
        const db = this.db || getDB();
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        const requiredCollections = [
            'agents',
            'agent_balances',
            'agent_transactions',
            'agent_voucher_sales',
            'agent_balance_requests',
            'agent_monthly_payments',
            'agent_notifications'
        ];

        for (const collName of requiredCollections) {
            if (!collectionNames.includes(collName)) {
                await db.createCollection(collName);
                console.log(`✅ Created collection: ${collName}`);
            }
        }
    }

    async createIndexes() {
        const db = this.db || getDB();

        await db.collection('agents').createIndex({ username: 1 }, { unique: true });
        await db.collection('agents').createIndex({ phone: 1 }, { unique: true });
        await db.collection('agents').createIndex({ status: 1 });

        await db.collection('agent_balances').createIndex({ agent_id: 1 }, { unique: true });

        await db.collection('agent_transactions').createIndex({ agent_id: 1 });
        await db.collection('agent_transactions').createIndex({ transaction_type: 1 });
        await db.collection('agent_transactions').createIndex({ created_at: -1 });

        await db.collection('agent_voucher_sales').createIndex({ agent_id: 1 });
        await db.collection('agent_voucher_sales').createIndex({ voucher_code: 1 }, { unique: true });
        await db.collection('agent_voucher_sales').createIndex({ status: 1 });

        await db.collection('agent_balance_requests').createIndex({ agent_id: 1 });
        await db.collection('agent_balance_requests').createIndex({ status: 1 });

        await db.collection('agent_monthly_payments').createIndex({ agent_id: 1 });
        await db.collection('agent_monthly_payments').createIndex({ customer_id: 1 });
        await db.collection('agent_monthly_payments').createIndex({ invoice_id: 1 });

        console.log('✅ Agent indexes created');
    }

    // Agent Management
    async createAgent(agentData) {
        const db = this.db || getDB();
        const { username, name, phone, email, password, address, commission_rate } = agentData;

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.collection('agents').insertOne({
            username,
            name,
            phone,
            email: email || null,
            password: hashedPassword,
            address: address || null,
            status: 'active',
            commission_rate: commission_rate || 5.00,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
        });

        const agentId = result.insertedId.toString();

        // Create balance record
        await db.collection('agent_balances').insertOne({
            agent_id: agentId,
            balance: 0.00,
            last_updated: new Date()
        });

        return { id: agentId, username, name, phone };
    }

    async getAgents(status = null) {
        const db = this.db || getDB();
        let query = {};
        if (status) query.status = status;

        const agents = await db.collection('agents').find(query).sort({ name: 1 }).toArray();
        return agents.map(agent => ({ ...agent, id: agent._id.toString() }));
    }

    async getAgentById(id) {
        const db = this.db || getDB();
        const agent = await db.collection('agents').findOne({ _id: new ObjectId(id) });
        return agent ? { ...agent, id: agent._id.toString() } : null;
    }

    async getAgentByUsername(username) {
        const db = this.db || getDB();
        const agent = await db.collection('agents').findOne({ username: username });
        return agent ? { ...agent, id: agent._id.toString() } : null;
    }

    async getAgentByPhone(phone) {
        const db = this.db || getDB();
        const agent = await db.collection('agents').findOne({ phone: phone });
        return agent ? { ...agent, id: agent._id.toString() } : null;
    }

    async updateAgent(id, agentData) {
        const db = this.db || getDB();
        const updateData = { ...agentData, updated_at: new Date() };

        if (agentData.password) {
            updateData.password = await bcrypt.hash(agentData.password, 10);
        }

        await db.collection('agents').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        return { id, ...agentData };
    }

    async deleteAgent(id) {
        const db = this.db || getDB();
        await db.collection('agents').updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: 'inactive', is_active: false } }
        );

        return { id, deleted: true };
    }

    async authenticateAgent(username, password) {
        const agent = await this.getAgentByUsername(username);
        if (!agent) {
            throw new Error('Invalid credentials');
        }

        if (agent.status !== 'active') {
            throw new Error('Agent account is not active');
        }

        const match = await bcrypt.compare(password, agent.password);
        if (!match) {
            throw new Error('Invalid credentials');
        }

        return agent;
    }

    // Balance Management
    async getAgentBalance(agentId) {
        const db = this.db || getDB();
        const balance = await db.collection('agent_balances').findOne({ agent_id: agentId });
        return balance ? balance.balance : 0.00;
    }

    async updateAgentBalance(agentId, amount, transactionType, description = null) {
        const db = this.db || getDB();

        // Update balance
        await db.collection('agent_balances').updateOne(
            { agent_id: agentId },
            {
                $inc: { balance: amount },
                $set: { last_updated: new Date() }
            },
            { upsert: true }
        );

        // Record transaction
        await db.collection('agent_transactions').insertOne({
            agent_id: agentId,
            transaction_type: transactionType,
            amount: amount,
            description: description,
            status: 'completed',
            created_at: new Date()
        });

        return await this.getAgentBalance(agentId);
    }

    async addAgentBalance(agentId, amount, description = null) {
        return await this.updateAgentBalance(agentId, amount, 'deposit', description);
    }

    async deductAgentBalance(agentId, amount, description = null) {
        const currentBalance = await this.getAgentBalance(agentId);
        if (currentBalance < amount) {
            throw new Error('Insufficient balance');
        }
        return await this.updateAgentBalance(agentId, -amount, 'withdrawal', description);
    }

    // Transaction Management
    async getAgentTransactions(agentId, limit = 50) {
        const db = this.db || getDB();
        const transactions = await db.collection('agent_transactions')
            .find({ agent_id: agentId })
            .sort({ created_at: -1 })
            .limit(limit)
            .toArray();

        return transactions.map(tx => ({ ...tx, id: tx._id.toString() }));
    }

    async getAgentTransactionsByType(agentId, transactionType, limit = 50) {
        const db = this.db || getDB();
        const transactions = await db.collection('agent_transactions')
            .find({ agent_id: agentId, transaction_type: transactionType })
            .sort({ created_at: -1 })
            .limit(limit)
            .toArray();

        return transactions.map(tx => ({ ...tx, id: tx._id.toString() }));
    }

    // Voucher Sales Management
    async recordVoucherSale(saleData) {
        const db = this.db || getDB();
        const { agent_id, voucher_code, package_id, package_name, customer_phone, customer_name, price, commission } = saleData;

        const result = await db.collection('agent_voucher_sales').insertOne({
            agent_id,
            voucher_code,
            package_id,
            package_name,
            customer_phone: customer_phone || null,
            customer_name: customer_name || null,
            price,
            commission: commission || 0.00,
            status: 'active',
            sold_at: new Date(),
            used_at: null,
            notes: null
        });

        // Deduct from agent balance
        await this.deductAgentBalance(agent_id, price, `Voucher sale: ${voucher_code}`);

        // Add commission
        if (commission > 0) {
            await this.addAgentBalance(agent_id, commission, `Commission for voucher: ${voucher_code}`);
        }

        return { id: result.insertedId.toString(), ...saleData };
    }

    async getAgentVoucherSales(agentId, status = null) {
        const db = this.db || getDB();
        let query = { agent_id: agentId };
        if (status) query.status = status;

        const sales = await db.collection('agent_voucher_sales')
            .find(query)
            .sort({ sold_at: -1 })
            .toArray();

        return sales.map(sale => ({ ...sale, id: sale._id.toString() }));
    }

    async updateVoucherStatus(voucherCode, status) {
        const db = this.db || getDB();
        const updateData = { status };

        if (status === 'used') {
            updateData.used_at = new Date();
        }

        await db.collection('agent_voucher_sales').updateOne(
            { voucher_code: voucherCode },
            { $set: updateData }
        );

        return { voucher_code: voucherCode, status };
    }

    // Balance Request Management
    async createBalanceRequest(agentId, amount) {
        const db = this.db || getDB();

        const result = await db.collection('agent_balance_requests').insertOne({
            agent_id: agentId,
            amount,
            status: 'pending',
            admin_notes: null,
            requested_at: new Date(),
            processed_at: null,
            processed_by: null
        });

        return { id: result.insertedId.toString(), agent_id: agentId, amount, status: 'pending' };
    }

    async getBalanceRequests(status = null) {
        const db = this.db || getDB();
        let query = {};
        if (status) query.status = status;

        const requests = await db.collection('agent_balance_requests')
            .find(query)
            .sort({ requested_at: -1 })
            .toArray();

        return requests.map(req => ({ ...req, id: req._id.toString() }));
    }

    async getAgentBalanceRequests(agentId, status = null) {
        const db = this.db || getDB();
        let query = { agent_id: agentId };
        if (status) query.status = status;

        const requests = await db.collection('agent_balance_requests')
            .find(query)
            .sort({ requested_at: -1 })
            .toArray();

        return requests.map(req => ({ ...req, id: req._id.toString() }));
    }

    async approveBalanceRequest(requestId, adminId, adminNotes = null) {
        const db = this.db || getDB();

        const request = await db.collection('agent_balance_requests').findOne({ _id: new ObjectId(requestId) });
        if (!request) {
            throw new Error('Balance request not found');
        }

        if (request.status !== 'pending') {
            throw new Error('Balance request already processed');
        }

        // Update request status
        await db.collection('agent_balance_requests').updateOne(
            { _id: new ObjectId(requestId) },
            {
                $set: {
                    status: 'approved',
                    admin_notes: adminNotes,
                    processed_at: new Date(),
                    processed_by: adminId
                }
            }
        );

        // Add balance to agent
        await this.addAgentBalance(request.agent_id, request.amount, `Balance request approved`);

        return { id: requestId, status: 'approved' };
    }

    async rejectBalanceRequest(requestId, adminId, adminNotes = null) {
        const db = this.db || getDB();

        await db.collection('agent_balance_requests').updateOne(
            { _id: new ObjectId(requestId) },
            {
                $set: {
                    status: 'rejected',
                    admin_notes: adminNotes,
                    processed_at: new Date(),
                    processed_by: adminId
                }
            }
        );

        return { id: requestId, status: 'rejected' };
    }

    // Monthly Payment Management
    async recordMonthlyPayment(paymentData) {
        const db = this.db || getDB();
        const { agent_id, customer_id, invoice_id, payment_amount, commission_amount, payment_method, notes } = paymentData;

        const result = await db.collection('agent_monthly_payments').insertOne({
            agent_id,
            customer_id,
            invoice_id,
            payment_amount,
            commission_amount: commission_amount || 0.00,
            payment_method: payment_method || 'cash',
            notes: notes || null,
            status: 'completed',
            paid_at: new Date()
        });

        // Deduct payment from agent balance
        await this.deductAgentBalance(agent_id, payment_amount, `Monthly payment for invoice: ${invoice_id}`);

        // Add commission
        if (commission_amount > 0) {
            await this.addAgentBalance(agent_id, commission_amount, `Commission for payment: ${invoice_id}`);
        }

        return { id: result.insertedId.toString(), ...paymentData };
    }

    async getAgentMonthlyPayments(agentId, limit = 50) {
        const db = this.db || getDB();
        const payments = await db.collection('agent_monthly_payments')
            .find({ agent_id: agentId })
            .sort({ paid_at: -1 })
            .limit(limit)
            .toArray();

        return payments.map(payment => ({ ...payment, id: payment._id.toString() }));
    }

    // Statistics
    async getAgentStats(agentId) {
        const db = this.db || getDB();

        const [
            balance,
            totalVoucherSales,
            totalMonthlyPayments,
            totalCommission
        ] = await Promise.all([
            this.getAgentBalance(agentId),
            db.collection('agent_voucher_sales').countDocuments({ agent_id: agentId, status: 'active' }),
            db.collection('agent_monthly_payments').countDocuments({ agent_id: agentId }),
            db.collection('agent_transactions').aggregate([
                { $match: { agent_id: agentId, transaction_type: 'commission' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).toArray()
        ]);

        return {
            balance,
            totalVoucherSales,
            totalMonthlyPayments,
            totalCommission: totalCommission.length > 0 ? totalCommission[0].total : 0
        };
    }

    // Notifications
    async createNotification(agentId, message, type = 'info') {
        const db = this.db || getDB();

        const result = await db.collection('agent_notifications').insertOne({
            agent_id: agentId,
            message,
            type,
            is_read: false,
            created_at: new Date()
        });

        return { id: result.insertedId.toString(), agent_id: agentId, message };
    }

    async getAgentNotifications(agentId, unreadOnly = false) {
        const db = this.db || getDB();
        let query = { agent_id: agentId };
        if (unreadOnly) query.is_read = false;

        const notifications = await db.collection('agent_notifications')
            .find(query)
            .sort({ created_at: -1 })
            .limit(50)
            .toArray();

        return notifications.map(notif => ({ ...notif, id: notif._id.toString() }));
    }

    async markNotificationAsRead(notificationId) {
        const db = this.db || getDB();

        await db.collection('agent_notifications').updateOne(
            { _id: new ObjectId(notificationId) },
            { $set: { is_read: true } }
        );

        return { id: notificationId, is_read: true };
    }

    async markAllNotificationsAsRead(agentId) {
        const db = this.db || getDB();

        await db.collection('agent_notifications').updateMany(
            { agent_id: agentId, is_read: false },
            { $set: { is_read: true } }
        );

        return { agent_id: agentId, marked: true };
    }
}

module.exports = AgentManager;
