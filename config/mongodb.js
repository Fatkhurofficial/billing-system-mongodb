const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://root:-90nW9QkR2V3ebupmlZhV7uJ65W3YYeFpP09WYULo5eA90V6@8c7080df-74c9-4cc7-8151-b1d91d35e53b.asia-southeast2.firestore.goog:443/default?loadBalanced=true&tls=true&authMechanism=SCRAM-SHA-256&retryWrites=false';
const DB_NAME = 'default';

let client = null;
let db = null;

async function connectDB() {
    if (db) {
        return db;
    }

    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('✅ MongoDB connected successfully');
        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB() first.');
    }
    return db;
}

async function closeDB() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log('MongoDB connection closed');
    }
}

module.exports = {
    connectDB,
    getDB,
    closeDB
};
