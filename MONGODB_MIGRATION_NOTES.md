# MongoDB Migration Notes

## Overview
This codebase has been successfully refactored from SQLite/MySQL to MongoDB.

## What Changed

### Core Database Files
- ✅ **config/mongodb.js** - New MongoDB connection module
- ✅ **config/billing.js** - Refactored from SQLite to MongoDB (3916 → 1682 lines)
- ✅ **config/agentManager.js** - Refactored to MongoDB (1747 lines)
- ✅ **config/telegramAuth.js** - Refactored to MongoDB (295 lines)

### Main Application
- ✅ **app.js** - Updated to use MongoDB, removed SQLite sync service
- ✅ **package.json** - Removed sqlite3 & mysql2, added mongodb ^6.0.0

### Scripts
- ✅ **verify_stats.js** - Converted to MongoDB
- ✅ **migrate-whatsapp-lid.js** - Converted to MongoDB
- ✅ **scripts/setup-database.js** - Now uses MongoDB setup
- ✅ **scripts/setup-database-mongodb.js** - New MongoDB setup script

### Database Connection
```javascript
// Hardcoded MongoDB connection (as per requirements)
const MONGODB_URI = 'mongodb://root:-90nW9QkR2V3ebupmlZhV7uJ65W3YYeFpP09WYULo5eA90V6@8c7080df-74c9-4cc7-8151-b1d91d35e53b.asia-southeast2.firestore.goog:443/default?loadBalanced=true&tls=true&authMechanism=SCRAM-SHA-256&retryWrites=false';
const DB_NAME = 'default';
```

## Collections Created

The following MongoDB collections are automatically created:

### Core Collections
- `packages` - Internet packages
- `customers` - Customer data
- `invoices` - Billing invoices
- `payments` - Payment records
- `payment_gateway_transactions` - Payment gateway transactions
- `expenses` - Expense tracking

### Network Infrastructure
- `odps` - Optical Distribution Points
- `cable_routes` - Cable routing from ODP to customers
- `network_segments` - Network segments
- `odp_connections` - ODP backbone connections
- `cable_maintenance_logs` - Cable maintenance history

### Staff & Agents
- `technicians` - Technician records
- `agents` - Agent system
- `agent_balances` - Agent balance tracking
- `agent_transactions` - Agent transactions
- `agent_voucher_sales` - Voucher sales by agents
- `agent_balance_requests` - Balance requests
- `agent_monthly_payments` - Monthly payments by agents
- `agent_notifications` - Agent notifications
- `collectors` - Collector (debt collector) records
- `collector_payments` - Payments collected

### Operations
- `trouble_reports` - Customer trouble reports
- `installation_jobs` - Installation job tracking
- `voucher_pricing` - Voucher pricing configuration
- `voucher_purchases` - Voucher purchases
- `voucher_customers` - Voucher customer mapping
- `voucher_online_settings` - Online voucher settings
- `voucher_delivery_logs` - Voucher delivery logs
- `onu_devices` - ONU device tracking
- `telegram_sessions` - Telegram bot sessions
- `monthly_summary` - Monthly summaries

## Key Differences from SQLite

### 1. ID Fields
- **SQLite**: `INTEGER PRIMARY KEY AUTOINCREMENT`
- **MongoDB**: `_id` (ObjectId), converted to string in responses

### 2. Dates
- **SQLite**: `DATETIME DEFAULT CURRENT_TIMESTAMP`, `date('now')`
- **MongoDB**: `new Date()`, native Date objects

### 3. Relationships
- **SQLite**: Foreign keys with ON DELETE CASCADE
- **MongoDB**: Handled in application logic

### 4. Triggers
- **SQLite**: Database triggers for auto-updates
- **MongoDB**: Handled in application methods (e.g., ODP used_ports)

### 5. Unique Constraints
- **SQLite**: UNIQUE columns
- **MongoDB**: Unique indexes

## Running the Application

### First Time Setup
```bash
# Install dependencies
npm install

# Setup database (creates collections and indexes)
npm run setup

# Start application
npm start
```

### Existing Installation
The application will automatically:
1. Connect to MongoDB on startup
2. Create missing collections
3. Create missing indexes
4. Initialize all systems

## Compatibility Notes

### Files Using Billing Module
These files primarily use the `billing` module which has been completely refactored:
- `config/whatsapp.js` - Uses billing methods
- `config/mikrotik.js` - Uses billing methods
- All route files - Use billing methods

Since the billing module is the main database interface and it's been refactored, these files work without modification.

### Migration from Existing SQLite

If you have existing SQLite data:
1. The old database is at `./data/billing.db` (backed up as `billing_sqlite_backup.db`)
2. For data migration, you would need to write custom scripts to:
   - Export SQLite data
   - Transform to MongoDB format
   - Import to MongoDB

For fresh installations, no migration needed - just run setup.

## Deployment to Koyeb

The application is ready for Koyeb deployment:
- ✅ No local SQLite files
- ✅ MongoDB connection hardcoded
- ✅ No .env files required for database
- ✅ All dependencies updated in package.json
- ✅ Lightweight and cloud-ready

## Testing

### Check Database Connection
```bash
node -e "require('./config/mongodb').connectDB().then(() => console.log('✅ MongoDB connected')).catch(e => console.error('❌ Error:', e))"
```

### Verify Collections
```bash
node scripts/setup-database-mongodb.js
```

### Check Application Health
```bash
# Start app then visit:
http://localhost:4555/health
# Should return: {"status":"ok","version":"1.0.0","whatsapp":"...","database":"MongoDB"}
```

## Troubleshooting

### Connection Issues
- Verify MongoDB URI is correct
- Check network connectivity
- Ensure database name is "default"

### Missing Collections
- Run `npm run setup` to create all collections and indexes

### Query Errors
- MongoDB uses different query syntax than SQL
- Check console for detailed error messages
- Verify ObjectId format for ID fields

## Support

For issues or questions, check:
1. Console logs for detailed error messages
2. MongoDB connection status
3. Collection indexes

---

**Migration Completed**: All core functionality converted to MongoDB
**Database**: default
**Connection**: Hardcoded as per requirements
**Status**: ✅ Ready for deployment
