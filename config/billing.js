const path = require('path');
const fs = require('fs');
const { ObjectId } = require('mongodb');
const { connectDB, getDB } = require('./mongodb');
const PaymentGatewayManager = require('./paymentGateway');
const logger = require('./logger');
const { getCompanyHeader } = require('./message-templates');
const { getSetting } = require('./settingsManager');

class BillingManager {
    constructor() {
        this.paymentGateway = new PaymentGatewayManager();
        this.db = null;
        this.initDatabase();
    }

    async initDatabase() {
        try {
            this.db = await connectDB();
            console.log('Billing database connected (MongoDB)');
            await this.createCollections();
            await this.createIndexes();
        } catch (err) {
            console.error('Error opening billing database:', err);
            throw err;
        }
    }

    reloadPaymentGateway() {
        try {
            const result = this.paymentGateway.reload();
            return result;
        } catch (e) {
            try { logger.error('[BILLING] Failed to reload payment gateways:', e.message); } catch (_) { }
            return { error: true, message: e.message };
        }
    }

    async setCustomerStatusById(id, status) {
        try {
            const db = this.db || getDB();
            const existing = await this.getCustomerById(id);
            if (!existing) throw new Error('Customer not found');

            const result = await db.collection('customers').updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: status } }
            );

            try {
                logger.info(`[BILLING] setCustomerStatusById: id=${id}, username=${existing.username}, from=${existing.status} -> to=${status}`);
            } catch (_) { }

            return { id, status };
        } catch (e) {
            throw e;
        }
    }

    async updateCustomerById(id, customerData) {
        try {
            const db = this.db || getDB();
            const oldCustomer = await this.getCustomerById(id);
            if (!oldCustomer) throw new Error('Customer not found');

            const { name, username, pppoe_username, email, address, latitude, longitude, package_id, odp_id, pppoe_profile, status, auto_suspension, billing_day, cable_type, cable_length, port_number, cable_status, cable_notes } = customerData;

            const normBillingDay = Math.min(Math.max(parseInt(billing_day !== undefined ? billing_day : (oldCustomer?.billing_day ?? 15), 10) || 15, 1), 28);

            const updateData = {
                name: name ?? oldCustomer.name,
                username: username ?? oldCustomer.username,
                pppoe_username: pppoe_username ?? oldCustomer.pppoe_username,
                email: email ?? oldCustomer.email,
                address: address ?? oldCustomer.address,
                latitude: latitude !== undefined ? parseFloat(latitude) : oldCustomer.latitude,
                longitude: longitude !== undefined ? parseFloat(longitude) : oldCustomer.longitude,
                package_id: package_id ?? oldCustomer.package_id,
                odp_id: odp_id !== undefined ? odp_id : oldCustomer.odp_id,
                pppoe_profile: pppoe_profile ?? oldCustomer.pppoe_profile,
                status: status ?? oldCustomer.status,
                auto_suspension: auto_suspension !== undefined ? auto_suspension : oldCustomer.auto_suspension,
                billing_day: normBillingDay,
                cable_type: cable_type !== undefined ? cable_type : oldCustomer.cable_type,
                cable_length: cable_length !== undefined ? cable_length : oldCustomer.cable_length,
                port_number: port_number !== undefined ? port_number : oldCustomer.port_number,
                cable_status: cable_status !== undefined ? cable_status : oldCustomer.cable_status,
                cable_notes: cable_notes !== undefined ? cable_notes : oldCustomer.cable_notes
            };

            await db.collection('customers').updateOne(
                { _id: new ObjectId(id) },
                { $set: updateData }
            );

            // Sinkronisasi cable routes jika ada data ODP atau cable
            if (odp_id !== undefined || cable_type !== undefined) {
                console.log(`🔧 Updating cable route for customer ${oldCustomer.username}, odp_id: ${odp_id}, cable_type: ${cable_type}`);
                try {
                    const existingRoute = await db.collection('cable_routes').findOne({ customer_id: id });

                    if (existingRoute) {
                        console.log(`📝 Found existing cable route for customer ${oldCustomer.username}, updating...`);
                        await db.collection('cable_routes').updateOne(
                            { customer_id: id },
                            {
                                $set: {
                                    odp_id: odp_id !== undefined ? odp_id : existingRoute.odp_id,
                                    cable_type: cable_type !== undefined ? cable_type : existingRoute.cable_type,
                                    cable_length: cable_length !== undefined ? cable_length : existingRoute.cable_length,
                                    port_number: port_number !== undefined ? port_number : existingRoute.port_number,
                                    status: cable_status !== undefined ? cable_status : existingRoute.status,
                                    notes: cable_notes !== undefined ? cable_notes : existingRoute.notes,
                                    updated_at: new Date()
                                }
                            }
                        );
                        console.log(`✅ Successfully updated cable route for customer ${oldCustomer.username}`);
                    } else if (odp_id) {
                        console.log(`📝 Creating new cable route for customer ${oldCustomer.username}...`);
                        await db.collection('cable_routes').insertOne({
                            customer_id: id,
                            odp_id: odp_id,
                            cable_type: cable_type || 'Fiber Optic',
                            cable_length: cable_length || 0,
                            port_number: port_number || 1,
                            status: cable_status || 'connected',
                            notes: cable_notes || `Auto-created for customer ${oldCustomer.name}`,
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                        console.log(`✅ Successfully created cable route for customer ${oldCustomer.username}`);
                    }
                } catch (cableError) {
                    console.error(`❌ Error handling cable route for customer ${oldCustomer.username}:`, cableError.message);
                }
            }

            return { username: oldCustomer.username, id, ...customerData };
        } catch (error) {
            throw error;
        }
    }

    async updateCustomerCoordinates(id, coordinates) {
        const { latitude, longitude } = coordinates;

        if (latitude === undefined || longitude === undefined) {
            throw new Error('Latitude dan longitude wajib diisi');
        }

        const db = this.db || getDB();
        const result = await db.collection('customers').updateOne(
            { _id: new ObjectId(id) },
            { $set: { latitude: latitude, longitude: longitude } }
        );

        return { id, latitude, longitude, changes: result.modifiedCount };
    }

    async getCustomerBySerialNumber(serialNumber) {
        const db = this.db || getDB();
        const row = await db.collection('customers').findOne({ serial_number: serialNumber });
        return row || null;
    }

    async getCustomerByPPPoE(pppoeUsername) {
        const db = this.db || getDB();
        const row = await db.collection('customers').findOne({ pppoe_username: pppoeUsername });
        return row || null;
    }

    async createCollections() {
        const db = this.db || getDB();
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        const requiredCollections = [
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
            'agent_sales',
            'collectors',
            'collector_payments',
            'installation_jobs',
            'voucher_pricing',
            'voucher_purchases',
            'voucher_customers',
            'onu_devices',
            'telegram_sessions'
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

        // Indexes untuk customers
        await db.collection('customers').createIndex({ username: 1 }, { unique: true });
        await db.collection('customers').createIndex({ phone: 1 }, { unique: true });
        await db.collection('customers').createIndex({ pppoe_username: 1 });
        await db.collection('customers').createIndex({ whatsapp_lid: 1 });
        await db.collection('customers').createIndex({ package_id: 1 });
        await db.collection('customers').createIndex({ odp_id: 1 });

        // Indexes untuk invoices
        await db.collection('invoices').createIndex({ invoice_number: 1 }, { unique: true });
        await db.collection('invoices').createIndex({ customer_id: 1 });
        await db.collection('invoices').createIndex({ status: 1 });
        await db.collection('invoices').createIndex({ due_date: 1 });

        // Indexes untuk packages
        await db.collection('packages').createIndex({ name: 1 });
        await db.collection('packages').createIndex({ is_active: 1 });

        // Indexes untuk ODPs
        await db.collection('odps').createIndex({ code: 1 }, { unique: true });
        await db.collection('odps').createIndex({ name: 1 }, { unique: true });
        await db.collection('odps').createIndex({ latitude: 1, longitude: 1 });
        await db.collection('odps').createIndex({ status: 1 });

        // Indexes untuk cable_routes
        await db.collection('cable_routes').createIndex({ customer_id: 1 });
        await db.collection('cable_routes').createIndex({ odp_id: 1 });
        await db.collection('cable_routes').createIndex({ status: 1 });

        // Indexes untuk payments
        await db.collection('payments').createIndex({ invoice_id: 1 });
        await db.collection('payments').createIndex({ payment_date: 1 });

        console.log('✅ Database indexes created');
    }

    // Package Management
    async createPackage(packageData) {
        const { name, speed, price, tax_rate, description, pppoe_profile, image_filename } = packageData;
        const db = this.db || getDB();

        const result = await db.collection('packages').insertOne({
            name,
            speed,
            price,
            tax_rate: tax_rate !== undefined ? tax_rate : 11.00,
            description,
            pppoe_profile: pppoe_profile || 'default',
            image_filename: image_filename || null,
            is_active: true,
            created_at: new Date()
        });

        return { id: result.insertedId.toString(), ...packageData };
    }

    async getPackages() {
        const db = this.db || getDB();
        const rows = await db.collection('packages')
            .find({ is_active: true })
            .sort({ price: 1 })
            .toArray();

        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getPackageById(id) {
        const db = this.db || getDB();
        const row = await db.collection('packages').findOne({ _id: new ObjectId(id) });
        return row ? { ...row, id: row._id.toString() } : null;
    }

    async updatePackage(id, packageData) {
        const { name, speed, price, tax_rate, description, pppoe_profile, image_filename } = packageData;
        const db = this.db || getDB();

        await db.collection('packages').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    name,
                    speed,
                    price,
                    tax_rate: tax_rate || 0,
                    description,
                    pppoe_profile: pppoe_profile || 'default',
                    image_filename: image_filename || null
                }
            }
        );

        return { id, ...packageData };
    }

    async deletePackage(id) {
        const db = this.db || getDB();
        await db.collection('packages').updateOne(
            { _id: new ObjectId(id) },
            { $set: { is_active: false } }
        );

        return { id, deleted: true };
    }

    // Customer Management
    generateUsername(phone) {
        const timestamp = Date.now();
        const phoneDigits = phone.toString().replace(/\D/g, '').slice(-4);
        return `cust_${phoneDigits}_${timestamp}`;
    }

    generatePPPoEUsername(phone) {
        const phoneDigits = phone.toString().replace(/\D/g, '').slice(-4);
        const random = Math.floor(Math.random() * 1000);
        return `pppoe_${phoneDigits}_${random}`;
    }

    async createCustomer(customerData) {
        const db = this.db || getDB();
        const { name, username, phone, pppoe_username, email, address, package_id, odp_id, pppoe_profile, status, auto_suspension, billing_day, static_ip, assigned_ip, mac_address, latitude, longitude, cable_type, cable_length, port_number, cable_status, cable_notes } = customerData;

        const finalUsername = username || this.generateUsername(phone);
        const autoPPPoEUsername = pppoe_username || this.generatePPPoEUsername(phone);
        const normBillingDay = Math.min(Math.max(parseInt(billing_day ?? 15, 10) || 15, 1), 28);
        const finalLatitude = latitude !== undefined ? parseFloat(latitude) : -6.2088;
        const finalLongitude = longitude !== undefined ? parseFloat(longitude) : 106.8456;

        const result = await db.collection('customers').insertOne({
            username: finalUsername,
            name,
            phone,
            pppoe_username: autoPPPoEUsername,
            email,
            address,
            package_id,
            odp_id: odp_id || null,
            pppoe_profile,
            status: status || 'active',
            auto_suspension: auto_suspension !== undefined ? auto_suspension : 1,
            billing_day: normBillingDay,
            static_ip: static_ip || null,
            assigned_ip: assigned_ip || null,
            mac_address: mac_address || null,
            latitude: finalLatitude,
            longitude: finalLongitude,
            cable_type: cable_type || null,
            cable_length: cable_length || null,
            port_number: port_number || null,
            cable_status: cable_status || 'connected',
            cable_notes: cable_notes || null,
            join_date: new Date()
        });

        const customerId = result.insertedId.toString();

        // Jika ada data ODP, buat cable route otomatis
        if (odp_id) {
            console.log(`🔧 Creating cable route for new customer ${finalUsername}, odp_id: ${odp_id}`);
            try {
                await db.collection('cable_routes').insertOne({
                    customer_id: customerId,
                    odp_id: odp_id,
                    cable_type: cable_type || 'Fiber Optic',
                    cable_length: cable_length || 0,
                    port_number: port_number || 1,
                    status: cable_status || 'connected',
                    notes: cable_notes || `Auto-created for customer ${name}`,
                    created_at: new Date(),
                    updated_at: new Date()
                });
                console.log(`✅ Successfully created cable route for customer ${finalUsername}`);
            } catch (cableError) {
                console.error(`❌ Error creating cable route:`, cableError.message);
            }
        }

        // GenieACS integration (dengan timeout)
        if (phone && autoPPPoEUsername) {
            try {
                const genieacsPromise = Promise.race([
                    (async () => {
                        const genieacs = require('./genieacs');
                        const device = await genieacs.findDeviceByPPPoE(autoPPPoEUsername);
                        if (device) {
                            await genieacs.addTagToDevice(device._id, phone);
                            console.log(`✅ Added phone tag ${phone} to device for customer ${finalUsername}`);
                        }
                    })(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
                ]);
                await genieacsPromise;
            } catch (err) {
                console.log(`⚠️ GenieACS integration skipped: ${err.message}`);
            }
        }

        return { id: customerId, ...customerData };
    }

    async getCustomers() {
        const db = this.db || getDB();
        const pipeline = [
            {
                $lookup: {
                    from: 'packages',
                    localField: 'package_id',
                    foreignField: '_id',
                    as: 'package'
                }
            },
            {
                $unwind: {
                    path: '$package',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'invoices',
                    let: { customerId: { $toString: '$_id' } },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$customer_id', '$$customerId'] },
                                status: 'unpaid'
                            }
                        },
                        {
                            $project: {
                                due_date: 1,
                                status: 1
                            }
                        }
                    ],
                    as: 'unpaid_invoices'
                }
            },
            {
                $addFields: {
                    id: { $toString: '$_id' },
                    package_name: '$package.name',
                    package_price: '$package.price',
                    package_image: '$package.image_filename',
                    payment_status: {
                        $cond: {
                            if: {
                                $gt: [
                                    {
                                        $size: {
                                            $filter: {
                                                input: '$unpaid_invoices',
                                                cond: { $lt: ['$$this.due_date', new Date()] }
                                            }
                                        }
                                    },
                                    0
                                ]
                            },
                            then: 'overdue',
                            else: {
                                $cond: {
                                    if: { $gt: [{ $size: '$unpaid_invoices' }, 0] },
                                    then: 'unpaid',
                                    else: 'paid'
                                }
                            }
                        }
                    }
                }
            },
            {
                $sort: { name: 1 }
            }
        ];

        const rows = await db.collection('customers').aggregate(pipeline).toArray();
        return rows;
    }

    async getCustomerByUsername(username) {
        const db = this.db || getDB();
        const pipeline = [
            {
                $match: { username: username }
            },
            {
                $lookup: {
                    from: 'packages',
                    localField: 'package_id',
                    foreignField: '_id',
                    as: 'package'
                }
            },
            {
                $unwind: {
                    path: '$package',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    id: { $toString: '$_id' },
                    package_name: '$package.name',
                    package_price: '$package.price',
                    package_speed: '$package.speed',
                    package_image: '$package.image_filename'
                }
            }
        ];

        const rows = await db.collection('customers').aggregate(pipeline).toArray();
        return rows.length > 0 ? rows[0] : null;
    }

    async searchCustomers(searchTerm) {
        const db = this.db || getDB();
        const searchPattern = new RegExp(searchTerm, 'i');

        const rows = await db.collection('customers')
            .find({
                $or: [
                    { name: searchPattern },
                    { phone: searchPattern },
                    { username: searchPattern },
                    { pppoe_username: searchPattern }
                ]
            })
            .limit(20)
            .sort({ name: 1 })
            .toArray();

        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getCustomerById(id) {
        const db = this.db || getDB();
        const pipeline = [
            {
                $match: { _id: new ObjectId(id) }
            },
            {
                $lookup: {
                    from: 'packages',
                    localField: 'package_id',
                    foreignField: '_id',
                    as: 'package'
                }
            },
            {
                $unwind: {
                    path: '$package',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    id: { $toString: '$_id' },
                    package_name: '$package.name',
                    speed: '$package.speed',
                    price: '$package.price',
                    package_image: '$package.image_filename'
                }
            }
        ];

        const rows = await db.collection('customers').aggregate(pipeline).toArray();
        return rows.length > 0 ? rows[0] : null;
    }

    async getCustomerByPhone(phone) {
        const db = this.db || getDB();
        const digitsOnly = (phone || '').toString().replace(/\D/g, '');
        const intl = digitsOnly.startsWith('62') ? digitsOnly : (digitsOnly.startsWith('0') ? ('62' + digitsOnly.slice(1)) : digitsOnly);
        const local08 = digitsOnly.startsWith('62') ? ('0' + digitsOnly.slice(2)) : (digitsOnly.startsWith('0') ? digitsOnly : ('0' + digitsOnly));

        const pipeline = [
            {
                $match: {
                    $or: [
                        { phone: intl },
                        { phone: local08 },
                        { phone: digitsOnly }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'packages',
                    localField: 'package_id',
                    foreignField: '_id',
                    as: 'package'
                }
            },
            {
                $unwind: {
                    path: '$package',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'invoices',
                    let: { customerId: { $toString: '$_id' } },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$customer_id', '$$customerId'] },
                                status: 'unpaid'
                            }
                        }
                    ],
                    as: 'unpaid_invoices'
                }
            },
            {
                $addFields: {
                    id: { $toString: '$_id' },
                    package_name: '$package.name',
                    package_price: '$package.price',
                    package_speed: '$package.speed',
                    package_image: '$package.image_filename',
                    payment_status: {
                        $cond: {
                            if: {
                                $gt: [
                                    {
                                        $size: {
                                            $filter: {
                                                input: '$unpaid_invoices',
                                                cond: { $lt: ['$$this.due_date', new Date()] }
                                            }
                                        }
                                    },
                                    0
                                ]
                            },
                            then: 'overdue',
                            else: {
                                $cond: {
                                    if: { $gt: [{ $size: '$unpaid_invoices' }, 0] },
                                    then: 'unpaid',
                                    else: 'paid'
                                }
                            }
                        }
                    }
                }
            }
        ];

        const rows = await db.collection('customers').aggregate(pipeline).toArray();
        return rows.length > 0 ? rows[0] : null;
    }

    async getCustomerByWhatsAppLid(lid) {
        if (!lid) return null;

        const db = this.db || getDB();
        const pipeline = [
            {
                $match: { whatsapp_lid: lid }
            },
            {
                $lookup: {
                    from: 'packages',
                    localField: 'package_id',
                    foreignField: '_id',
                    as: 'package'
                }
            },
            {
                $unwind: {
                    path: '$package',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'invoices',
                    let: { customerId: { $toString: '$_id' } },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$customer_id', '$$customerId'] },
                                status: 'unpaid'
                            }
                        }
                    ],
                    as: 'unpaid_invoices'
                }
            },
            {
                $addFields: {
                    id: { $toString: '$_id' },
                    package_name: '$package.name',
                    package_price: '$package.price',
                    package_speed: '$package.speed',
                    package_image: '$package.image_filename',
                    payment_status: {
                        $cond: {
                            if: {
                                $gt: [
                                    {
                                        $size: {
                                            $filter: {
                                                input: '$unpaid_invoices',
                                                cond: { $lt: ['$$this.due_date', new Date()] }
                                            }
                                        }
                                    },
                                    0
                                ]
                            },
                            then: 'overdue',
                            else: {
                                $cond: {
                                    if: { $gt: [{ $size: '$unpaid_invoices' }, 0] },
                                    then: 'unpaid',
                                    else: 'paid'
                                }
                            }
                        }
                    }
                }
            }
        ];

        const rows = await db.collection('customers').aggregate(pipeline).toArray();
        return rows.length > 0 ? rows[0] : null;
    }

    async updateCustomerWhatsAppLid(customerId, lid) {
        if (!customerId || !lid) {
            throw new Error('Customer ID and WhatsApp LID are required');
        }

        const db = this.db || getDB();

        // Check if LID is already used
        const existingCustomer = await db.collection('customers').findOne({
            whatsapp_lid: lid,
            _id: { $ne: new ObjectId(customerId) }
        });

        if (existingCustomer) {
            throw new Error(`WhatsApp LID sudah terdaftar untuk pelanggan: ${existingCustomer.name}`);
        }

        const result = await db.collection('customers').updateOne(
            { _id: new ObjectId(customerId) },
            { $set: { whatsapp_lid: lid } }
        );

        return {
            id: customerId,
            whatsapp_lid: lid,
            updated: result.modifiedCount > 0
        };
    }

    async getCustomerByNameOrPhone(searchTerm) {
        const db = this.db || getDB();
        const cleanPhone = searchTerm.replace(/\D/g, '');
        const searchPattern = new RegExp(searchTerm, 'i');

        const pipeline = [
            {
                $match: {
                    $or: [
                        { phone: cleanPhone },
                        { name: searchPattern },
                        { username: searchPattern }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'packages',
                    localField: 'package_id',
                    foreignField: '_id',
                    as: 'package'
                }
            },
            {
                $unwind: {
                    path: '$package',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    id: { $toString: '$_id' },
                    package_name: '$package.name',
                    package_price: '$package.price',
                    package_speed: '$package.speed',
                    package_image: '$package.image_filename'
                }
            },
            {
                $limit: 1
            }
        ];

        const rows = await db.collection('customers').aggregate(pipeline).toArray();
        return rows.length > 0 ? rows[0] : null;
    }

    async findCustomersByNameOrPhone(searchTerm) {
        const db = this.db || getDB();
        const cleanPhone = searchTerm.replace(/\D/g, '');
        const searchPattern = new RegExp(searchTerm, 'i');

        const pipeline = [
            {
                $match: {
                    $or: [
                        { phone: cleanPhone },
                        { name: searchPattern },
                        { username: searchPattern }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'packages',
                    localField: 'package_id',
                    foreignField: '_id',
                    as: 'package'
                }
            },
            {
                $unwind: {
                    path: '$package',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    id: { $toString: '$_id' },
                    package_name: '$package.name',
                    package_price: '$package.price',
                    package_speed: '$package.speed'
                }
            },
            {
                $limit: 5
            }
        ];

        const rows = await db.collection('customers').aggregate(pipeline).toArray();
        return rows || [];
    }

    async updateCustomer(phone, customerData) {
        return this.updateCustomerByPhone(phone, customerData);
    }

    async updateCustomerByPhone(oldPhone, customerData) {
        const db = this.db || getDB();
        const { name, username, phone, pppoe_username, email, address, package_id, odp_id, pppoe_profile, status, auto_suspension, billing_day, latitude, longitude, cable_type, cable_length, port_number, cable_status, cable_notes } = customerData;

        const oldCustomer = await this.getCustomerByPhone(oldPhone);
        if (!oldCustomer) {
            throw new Error('Pelanggan tidak ditemukan');
        }

        const normBillingDay = Math.min(Math.max(parseInt(billing_day !== undefined ? billing_day : (oldCustomer?.billing_day ?? 15), 10) || 15, 1), 28);

        const updateData = {
            name,
            username: username || oldCustomer.username,
            phone: phone || oldPhone,
            pppoe_username,
            email,
            address,
            package_id,
            odp_id: odp_id !== undefined ? odp_id : oldCustomer.odp_id,
            pppoe_profile,
            status,
            auto_suspension: auto_suspension !== undefined ? auto_suspension : oldCustomer.auto_suspension,
            billing_day: normBillingDay,
            latitude: latitude !== undefined ? parseFloat(latitude) : oldCustomer.latitude,
            longitude: longitude !== undefined ? parseFloat(longitude) : oldCustomer.longitude,
            cable_type: cable_type !== undefined ? cable_type : oldCustomer.cable_type,
            cable_length: cable_length !== undefined ? cable_length : oldCustomer.cable_length,
            port_number: port_number !== undefined ? port_number : oldCustomer.port_number,
            cable_status: cable_status !== undefined ? cable_status : oldCustomer.cable_status,
            cable_notes: cable_notes !== undefined ? cable_notes : oldCustomer.cable_notes
        };

        await db.collection('customers').updateOne(
            { _id: new ObjectId(oldCustomer.id) },
            { $set: updateData }
        );

        return { phone: oldPhone, ...customerData };
    }

    async deleteCustomer(phone) {
        const customer = await this.getCustomerByPhone(phone);
        if (!customer) {
            throw new Error('Pelanggan tidak ditemukan');
        }
        return this.deleteCustomerById(customer.id);
    }

    async deleteCustomerById(id) {
        const db = this.db || getDB();

        // Delete related records
        await db.collection('cable_routes').deleteMany({ customer_id: id });
        await db.collection('invoices').deleteMany({ customer_id: id });
        await db.collection('trouble_reports').deleteMany({ customer_id: id });

        // Delete customer
        await db.collection('customers').deleteOne({ _id: new ObjectId(id) });

        return { id, deleted: true };
    }

    // Invoice Management
    async createInvoice(invoiceData) {
        const db = this.db || getDB();
        const { customer_id, package_id, invoice_number, amount, due_date, status, payment_method, payment_gateway, payment_token, payment_url, payment_status, notes, invoice_type, package_name, description } = invoiceData;

        const result = await db.collection('invoices').insertOne({
            customer_id,
            package_id,
            invoice_number,
            amount,
            due_date: new Date(due_date),
            status: status || 'unpaid',
            payment_date: null,
            payment_method: payment_method || null,
            payment_gateway: payment_gateway || null,
            payment_token: payment_token || null,
            payment_url: payment_url || null,
            payment_status: payment_status || 'pending',
            notes: notes || null,
            invoice_type: invoice_type || 'monthly',
            package_name: package_name || null,
            description: description || null,
            created_at: new Date()
        });

        return { id: result.insertedId.toString(), ...invoiceData };
    }

    async getInvoices(customerUsername = null, limit = null, offset = null) {
        const db = this.db || getDB();
        let query = {};

        if (customerUsername) {
            const customer = await this.getCustomerByUsername(customerUsername);
            if (customer) {
                query.customer_id = customer.id;
            }
        }

        let cursor = db.collection('invoices').find(query).sort({ due_date: -1 });

        if (limit) cursor = cursor.limit(limit);
        if (offset) cursor = cursor.skip(offset);

        const rows = await cursor.toArray();
        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getUnpaidInvoices() {
        const db = this.db || getDB();
        const pipeline = [
            {
                $match: { status: 'unpaid' }
            },
            {
                $lookup: {
                    from: 'customers',
                    let: { customerId: { $toObjectId: '$customer_id' } },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$_id', '$$customerId'] }
                            }
                        }
                    ],
                    as: 'customer'
                }
            },
            {
                $unwind: {
                    path: '$customer',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    id: { $toString: '$_id' },
                    customer_name: '$customer.name',
                    customer_phone: '$customer.phone'
                }
            },
            {
                $sort: { due_date: -1 }
            }
        ];

        const rows = await db.collection('invoices').aggregate(pipeline).toArray();
        return rows;
    }

    async getPaidInvoices() {
        const db = this.db || getDB();
        const pipeline = [
            {
                $match: { status: 'paid' }
            },
            {
                $lookup: {
                    from: 'customers',
                    let: { customerId: { $toObjectId: '$customer_id' } },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$_id', '$$customerId'] }
                            }
                        }
                    ],
                    as: 'customer'
                }
            },
            {
                $unwind: {
                    path: '$customer',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    id: { $toString: '$_id' },
                    customer_name: '$customer.name',
                    customer_phone: '$customer.phone'
                }
            },
            {
                $sort: { payment_date: -1 }
            }
        ];

        const rows = await db.collection('invoices').aggregate(pipeline).toArray();
        return rows;
    }

    async getInvoicesCount(customerUsername = null) {
        const db = this.db || getDB();
        let query = {};

        if (customerUsername) {
            const customer = await this.getCustomerByUsername(customerUsername);
            if (customer) {
                query.customer_id = customer.id;
            }
        }

        const count = await db.collection('invoices').countDocuments(query);
        return count;
    }

    async getInvoicesByCustomer(customerId) {
        const db = this.db || getDB();
        const rows = await db.collection('invoices')
            .find({ customer_id: customerId })
            .sort({ due_date: -1 })
            .toArray();

        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getCustomersByPackage(packageId) {
        const db = this.db || getDB();
        const rows = await db.collection('customers')
            .find({ package_id: packageId })
            .sort({ name: 1 })
            .toArray();

        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getInvoicesByCustomerAndDateRange(customerUsername, startDate, endDate) {
        const db = this.db || getDB();
        const customer = await this.getCustomerByUsername(customerUsername);
        if (!customer) return [];

        const rows = await db.collection('invoices')
            .find({
                customer_id: customer.id,
                due_date: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            })
            .sort({ due_date: -1 })
            .toArray();

        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getInvoiceById(id) {
        const db = this.db || getDB();
        const pipeline = [
            {
                $match: { _id: new ObjectId(id) }
            },
            {
                $lookup: {
                    from: 'customers',
                    let: { customerId: { $toObjectId: '$customer_id' } },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$_id', '$$customerId'] }
                            }
                        }
                    ],
                    as: 'customer'
                }
            },
            {
                $lookup: {
                    from: 'packages',
                    let: { packageId: { $toObjectId: '$package_id' } },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$_id', '$$packageId'] }
                            }
                        }
                    ],
                    as: 'package'
                }
            },
            {
                $unwind: {
                    path: '$customer',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $unwind: {
                    path: '$package',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    id: { $toString: '$_id' },
                    customer_name: '$customer.name',
                    customer_phone: '$customer.phone',
                    customer_username: '$customer.username',
                    package_name: '$package.name'
                }
            }
        ];

        const rows = await db.collection('invoices').aggregate(pipeline).toArray();
        return rows.length > 0 ? rows[0] : null;
    }

    async updateInvoiceStatus(id, status, paymentMethod = null) {
        const db = this.db || getDB();
        const updateData = { status };
        if (status === 'paid') {
            updateData.payment_date = new Date();
            if (paymentMethod) {
                updateData.payment_method = paymentMethod;
            }
        }

        await db.collection('invoices').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        return { id, status };
    }

    async updateInvoice(id, invoiceData) {
        const db = this.db || getDB();
        await db.collection('invoices').updateOne(
            { _id: new ObjectId(id) },
            { $set: invoiceData }
        );

        return { id, ...invoiceData };
    }

    async deleteInvoice(id) {
        const db = this.db || getDB();
        await db.collection('invoices').deleteOne({ _id: new ObjectId(id) });
        await db.collection('payments').deleteMany({ invoice_id: id });

        return { id, deleted: true };
    }

    // Payment Management
    async recordPayment(paymentData) {
        const db = this.db || getDB();
        const { invoice_id, amount, payment_method, reference_number, notes } = paymentData;

        const result = await db.collection('payments').insertOne({
            invoice_id,
            amount,
            payment_date: new Date(),
            payment_method,
            reference_number: reference_number || null,
            notes: notes || null
        });

        // Update invoice status
        await this.updateInvoiceStatus(invoice_id, 'paid', payment_method);

        return { id: result.insertedId.toString(), ...paymentData };
    }

    // ODP Management
    async createODP(odpData) {
        const db = this.db || getDB();
        const result = await db.collection('odps').insertOne({
            ...odpData,
            used_ports: 0,
            created_at: new Date(),
            updated_at: new Date()
        });

        return { id: result.insertedId.toString(), ...odpData };
    }

    async getODPs() {
        const db = this.db || getDB();
        const rows = await db.collection('odps').find({}).sort({ name: 1 }).toArray();
        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getODPById(id) {
        const db = this.db || getDB();
        const row = await db.collection('odps').findOne({ _id: new ObjectId(id) });
        return row ? { ...row, id: row._id.toString() } : null;
    }

    async updateODP(id, odpData) {
        const db = this.db || getDB();
        await db.collection('odps').updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...odpData, updated_at: new Date() } }
        );

        return { id, ...odpData };
    }

    async deleteODP(id) {
        const db = this.db || getDB();
        await db.collection('odps').deleteOne({ _id: new ObjectId(id) });
        return { id, deleted: true };
    }

    // Cable Routes Management
    async getCableRoutes() {
        const db = this.db || getDB();
        const rows = await db.collection('cable_routes').find({}).toArray();
        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getCableRoutesByCustomer(customerId) {
        const db = this.db || getDB();
        const rows = await db.collection('cable_routes').find({ customer_id: customerId }).toArray();
        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getCableRoutesByODP(odpId) {
        const db = this.db || getDB();
        const rows = await db.collection('cable_routes').find({ odp_id: odpId }).toArray();
        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    // Expenses Management
    async createExpense(expenseData) {
        const db = this.db || getDB();
        const result = await db.collection('expenses').insertOne({
            ...expenseData,
            created_at: new Date(),
            updated_at: new Date()
        });

        return { id: result.insertedId.toString(), ...expenseData };
    }

    async getExpenses(startDate = null, endDate = null) {
        const db = this.db || getDB();
        let query = {};

        if (startDate && endDate) {
            query.expense_date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const rows = await db.collection('expenses')
            .find(query)
            .sort({ expense_date: -1 })
            .toArray();

        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async deleteExpense(id) {
        const db = this.db || getDB();
        await db.collection('expenses').deleteOne({ _id: new ObjectId(id) });
        return { id, deleted: true };
    }

    // Technicians Management
    async getTechnicians() {
        const db = this.db || getDB();
        const rows = await db.collection('technicians').find({ is_active: true }).toArray();
        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getTechnicianById(id) {
        const db = this.db || getDB();
        const row = await db.collection('technicians').findOne({ _id: new ObjectId(id) });
        return row ? { ...row, id: row._id.toString() } : null;
    }

    async getTechnicianByPhone(phone) {
        const db = this.db || getDB();
        const row = await db.collection('technicians').findOne({ phone: phone });
        return row ? { ...row, id: row._id.toString() } : null;
    }

    async createTechnician(technicianData) {
        const db = this.db || getDB();
        const result = await db.collection('technicians').insertOne({
            ...technicianData,
            is_active: true,
            created_at: new Date()
        });

        return { id: result.insertedId.toString(), ...technicianData };
    }

    async updateTechnician(id, technicianData) {
        const db = this.db || getDB();
        await db.collection('technicians').updateOne(
            { _id: new ObjectId(id) },
            { $set: technicianData }
        );

        return { id, ...technicianData };
    }

    async deleteTechnician(id) {
        const db = this.db || getDB();
        await db.collection('technicians').updateOne(
            { _id: new ObjectId(id) },
            { $set: { is_active: false } }
        );

        return { id, deleted: true };
    }

    // Trouble Reports Management
    async createTroubleReport(reportData) {
        const db = this.db || getDB();
        const result = await db.collection('trouble_reports').insertOne({
            ...reportData,
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
        });

        return { id: result.insertedId.toString(), ...reportData };
    }

    async getTroubleReports(status = null) {
        const db = this.db || getDB();
        let query = {};
        if (status) query.status = status;

        const rows = await db.collection('trouble_reports')
            .find(query)
            .sort({ created_at: -1 })
            .toArray();

        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getTroubleReportById(id) {
        const db = this.db || getDB();
        const row = await db.collection('trouble_reports').findOne({ _id: new ObjectId(id) });
        return row ? { ...row, id: row._id.toString() } : null;
    }

    async updateTroubleReport(id, reportData) {
        const db = this.db || getDB();
        await db.collection('trouble_reports').updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...reportData, updated_at: new Date() } }
        );

        return { id, ...reportData };
    }

    // Collectors Management
    async recordCollectorPayment(paymentData) {
        const db = this.db || getDB();
        const { collector_id, invoice_id, amount, payment_method, commission, notes } = paymentData;

        const result = await db.collection('collector_payments').insertOne({
            collector_id,
            invoice_id,
            amount,
            payment_method,
            commission: commission || 0,
            notes: notes || null,
            payment_date: new Date()
        });

        // Update invoice status
        await this.updateInvoiceStatus(invoice_id, 'paid', payment_method);

        return { id: result.insertedId.toString(), ...paymentData };
    }

    async getCollectorById(collectorId) {
        const db = this.db || getDB();
        const row = await db.collection('collectors').findOne({ _id: new ObjectId(collectorId) });
        return row ? { ...row, id: row._id.toString() } : null;
    }

    async recordCollectorPaymentRecord(paymentData) {
        return this.recordCollectorPayment(paymentData);
    }

    async getCollectorTodayPayments(collectorId) {
        const db = this.db || getDB();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const rows = await db.collection('collector_payments')
            .find({
                collector_id: collectorId,
                payment_date: { $gte: today, $lt: tomorrow }
            })
            .toArray();

        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getCollectorTotalCommission(collectorId) {
        const db = this.db || getDB();
        const result = await db.collection('collector_payments')
            .aggregate([
                { $match: { collector_id: collectorId } },
                { $group: { _id: null, total: { $sum: '$commission' } } }
            ])
            .toArray();

        return result.length > 0 ? result[0].total : 0;
    }

    async getCollectorTotalPayments(collectorId) {
        const db = this.db || getDB();
        const result = await db.collection('collector_payments')
            .aggregate([
                { $match: { collector_id: collectorId } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
            .toArray();

        return result.length > 0 ? result[0].total : 0;
    }

    async getCollectorRecentPayments(collectorId, limit = 5) {
        const db = this.db || getDB();
        const rows = await db.collection('collector_payments')
            .find({ collector_id: collectorId })
            .sort({ payment_date: -1 })
            .limit(limit)
            .toArray();

        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getCollectorAllPayments(collectorId) {
        const db = this.db || getDB();
        const rows = await db.collection('collector_payments')
            .find({ collector_id: collectorId })
            .sort({ payment_date: -1 })
            .toArray();

        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    // Agents Management
    async getAgents() {
        const db = this.db || getDB();
        const rows = await db.collection('agents').find({ is_active: true }).toArray();
        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async getAgentById(id) {
        const db = this.db || getDB();
        const row = await db.collection('agents').findOne({ _id: new ObjectId(id) });
        return row ? { ...row, id: row._id.toString() } : null;
    }

    async createAgent(agentData) {
        const db = this.db || getDB();
        const result = await db.collection('agents').insertOne({
            ...agentData,
            is_active: true,
            created_at: new Date()
        });

        return { id: result.insertedId.toString(), ...agentData };
    }

    async updateAgent(id, agentData) {
        const db = this.db || getDB();
        await db.collection('agents').updateOne(
            { _id: new ObjectId(id) },
            { $set: agentData }
        );

        return { id, ...agentData };
    }

    // Voucher Management
    async getVoucherPricing() {
        const db = this.db || getDB();
        const rows = await db.collection('voucher_pricing').find({}).toArray();
        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async createVoucherPurchase(purchaseData) {
        const db = this.db || getDB();
        const result = await db.collection('voucher_purchases').insertOne({
            ...purchaseData,
            created_at: new Date()
        });

        return { id: result.insertedId.toString(), ...purchaseData };
    }

    // Installation Jobs Management
    async getInstallationJobs(status = null) {
        const db = this.db || getDB();
        let query = {};
        if (status) query.status = status;

        const rows = await db.collection('installation_jobs')
            .find(query)
            .sort({ created_at: -1 })
            .toArray();

        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async createInstallationJob(jobData) {
        const db = this.db || getDB();
        const result = await db.collection('installation_jobs').insertOne({
            ...jobData,
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
        });

        return { id: result.insertedId.toString(), ...jobData };
    }

    async updateInstallationJob(id, jobData) {
        const db = this.db || getDB();
        await db.collection('installation_jobs').updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...jobData, updated_at: new Date() } }
        );

        return { id, ...jobData };
    }

    // Statistics & Dashboard
    async getDashboardStats() {
        const db = this.db || getDB();

        const [
            totalCustomers,
            activeCustomers,
            totalInvoices,
            unpaidInvoices,
            totalRevenue,
            monthlyRevenue
        ] = await Promise.all([
            db.collection('customers').countDocuments({}),
            db.collection('customers').countDocuments({ status: 'active' }),
            db.collection('invoices').countDocuments({}),
            db.collection('invoices').countDocuments({ status: 'unpaid' }),
            db.collection('invoices').aggregate([
                { $match: { status: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).toArray(),
            db.collection('invoices').aggregate([
                {
                    $match: {
                        status: 'paid',
                        payment_date: {
                            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                        }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).toArray()
        ]);

        return {
            totalCustomers,
            activeCustomers,
            totalInvoices,
            unpaidInvoices,
            totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
            monthlyRevenue: monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0
        };
    }

    // Utility Methods
    async query(collectionName, query = {}, options = {}) {
        const db = this.db || getDB();
        const rows = await db.collection(collectionName).find(query, options).toArray();
        return rows.map(row => ({ ...row, id: row._id.toString() }));
    }

    async queryOne(collectionName, query = {}) {
        const db = this.db || getDB();
        const row = await db.collection(collectionName).findOne(query);
        return row ? { ...row, id: row._id.toString() } : null;
    }

    async insert(collectionName, data) {
        const db = this.db || getDB();
        const result = await db.collection(collectionName).insertOne(data);
        return { id: result.insertedId.toString(), ...data };
    }

    async update(collectionName, query, data) {
        const db = this.db || getDB();
        await db.collection(collectionName).updateOne(query, { $set: data });
        return { updated: true };
    }

    async delete(collectionName, query) {
        const db = this.db || getDB();
        await db.collection(collectionName).deleteOne(query);
        return { deleted: true };
    }
}

module.exports = new BillingManager();
