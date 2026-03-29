/**
 * Telegram Bot Authentication Module
 * Handles user authentication and session management
 * REFACTORED FOR MONGODB
 */

const { getDB } = require('./mongodb');
const bcrypt = require('bcrypt');

class TelegramAuth {
    constructor() {
        this.sessionTimeout = 24; // hours
    }

    /**
     * Authenticate user with username and password
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Promise<Object>} User object with role
     */
    async authenticate(username, password) {
        const db = getDB();

        // Check admin credentials from settings
        const { getSetting } = require('./settingsManager');
        const adminUsername = getSetting('admin_username', 'admin');
        const adminPassword = getSetting('admin_password', 'admin');

        if (username === adminUsername && password === adminPassword) {
            return {
                username: adminUsername,
                role: 'admin',
                name: 'Administrator'
            };
        }

        // Check technician credentials
        const technician = await db.collection('technicians').findOne({
            phone: username,
            is_active: true
        });

        if (technician) {
            // For technicians, username is phone number and password is phone number
            if (password === technician.phone) {
                return {
                    username: technician.phone,
                    role: 'technician',
                    name: technician.name,
                    id: technician._id.toString()
                };
            }
        }

        // Check collector credentials
        const collector = await db.collection('collectors').findOne({
            phone: username,
            status: 'active'
        });

        if (collector) {
            // Check if password column exists and has value
            if (collector.password) {
                try {
                    const match = await bcrypt.compare(password, collector.password);
                    if (match) {
                        return {
                            username: collector.phone,
                            role: 'collector',
                            name: collector.name,
                            id: collector._id.toString()
                        };
                    }
                } catch (bcryptErr) {
                    // If bcrypt fails, try plain text comparison
                    if (password === collector.password) {
                        return {
                            username: collector.phone,
                            role: 'collector',
                            name: collector.name,
                            id: collector._id.toString()
                        };
                    }
                }
            } else {
                // Fallback: phone number as password
                if (password === collector.phone) {
                    return {
                        username: collector.phone,
                        role: 'collector',
                        name: collector.name,
                        id: collector._id.toString()
                    };
                }
            }
        }

        throw new Error('Invalid credentials');
    }

    /**
     * Create or update session for Telegram user
     * @param {number} chatId - Telegram chat ID
     * @param {Object} userData - User data
     * @returns {Promise<Object>} Session object
     */
    async createSession(chatId, userData) {
        const db = getDB();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + this.sessionTimeout);

        const sessionData = {
            chat_id: chatId,
            username: userData.username,
            role: userData.role,
            name: userData.name,
            user_id: userData.id || null,
            expires_at: expiresAt,
            created_at: new Date()
        };

        await db.collection('telegram_sessions').updateOne(
            { chat_id: chatId },
            { $set: sessionData },
            { upsert: true }
        );

        return sessionData;
    }

    /**
     * Get active session for chat ID
     * @param {number} chatId - Telegram chat ID
     * @returns {Promise<Object|null>} Session object or null
     */
    async getSession(chatId) {
        const db = getDB();

        const session = await db.collection('telegram_sessions').findOne({
            chat_id: chatId,
            expires_at: { $gt: new Date() }
        });

        return session;
    }

    /**
     * Delete session (logout)
     * @param {number} chatId - Telegram chat ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteSession(chatId) {
        const db = getDB();

        await db.collection('telegram_sessions').deleteOne({
            chat_id: chatId
        });

        return true;
    }

    /**
     * Clean up expired sessions
     * @returns {Promise<number>} Number of deleted sessions
     */
    async cleanExpiredSessions() {
        const db = getDB();

        const result = await db.collection('telegram_sessions').deleteMany({
            expires_at: { $lt: new Date() }
        });

        return result.deletedCount;
    }

    /**
     * Check if user has admin role
     * @param {number} chatId - Telegram chat ID
     * @returns {Promise<boolean>} Is admin
     */
    async isAdmin(chatId) {
        const session = await this.getSession(chatId);
        return session && session.role === 'admin';
    }

    /**
     * Check if user has technician role
     * @param {number} chatId - Telegram chat ID
     * @returns {Promise<boolean>} Is technician
     */
    async isTechnician(chatId) {
        const session = await this.getSession(chatId);
        return session && session.role === 'technician';
    }

    /**
     * Check if user has collector role
     * @param {number} chatId - Telegram chat ID
     * @returns {Promise<boolean>} Is collector
     */
    async isCollector(chatId) {
        const session = await this.getSession(chatId);
        return session && session.role === 'collector';
    }

    /**
     * Require authentication for command
     * @param {number} chatId - Telegram chat ID
     * @param {string[]} allowedRoles - Allowed roles (optional)
     * @returns {Promise<Object>} Session object
     * @throws {Error} If not authenticated or role not allowed
     */
    async requireAuth(chatId, allowedRoles = null) {
        const session = await this.getSession(chatId);

        if (!session) {
            throw new Error('Not authenticated. Please login with /login');
        }

        if (allowedRoles && !allowedRoles.includes(session.role)) {
            throw new Error('You do not have permission to use this command');
        }

        return session;
    }

    /**
     * Extend session expiration
     * @param {number} chatId - Telegram chat ID
     * @returns {Promise<boolean>} Success status
     */
    async extendSession(chatId) {
        const db = getDB();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + this.sessionTimeout);

        const result = await db.collection('telegram_sessions').updateOne(
            { chat_id: chatId },
            { $set: { expires_at: expiresAt } }
        );

        return result.modifiedCount > 0;
    }

    /**
     * Get all active sessions
     * @returns {Promise<Array>} Array of sessions
     */
    async getActiveSessions() {
        const db = getDB();

        const sessions = await db.collection('telegram_sessions')
            .find({ expires_at: { $gt: new Date() } })
            .toArray();

        return sessions;
    }

    /**
     * Get sessions count by role
     * @returns {Promise<Object>} Count by role
     */
    async getSessionsCountByRole() {
        const db = getDB();

        const result = await db.collection('telegram_sessions').aggregate([
            { $match: { expires_at: { $gt: new Date() } } },
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]).toArray();

        const counts = {};
        result.forEach(item => {
            counts[item._id] = item.count;
        });

        return counts;
    }
}

module.exports = new TelegramAuth();
