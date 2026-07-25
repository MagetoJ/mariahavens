const knex = require('knex');
const config = require('./knexfile.js');

// Determine environment (defaults to development)
const environment = process.env.NODE_ENV || 'development';
const db = knex(config[environment]);

async function clearAllWaiters() {
    try {
        console.log('Starting waiter clearance for the next shift...');
        
        // Full ISO timestamp for standard timestamp columns (e.g., updated_at, cleared_at)
        const nowIso = new Date().toISOString();
        
        // Extract just the time portion (HH:mm:ss) for the 'end_time' TIME column
        const currentTime = nowIso.split('T')[1].split('.')[0]; 

        // Fetch an admin user ID to fulfill the integer requirement for 'cleared_by'
        const admin = await db('staff').where('role', 'admin').first();
        const adminId = admin ? admin.id : null;

        // 1. Clear all pending orders
        const updatedOrders = await db('orders')
            .where('is_cleared', false)
            .orWhereNull('is_cleared')
            .update({
                is_cleared: true,
                cleared_at: nowIso,
                cleared_by: adminId 
            });
            
        console.log(`Successfully cleared ${updatedOrders} pending orders.`);

        // 2. End all active shifts
        const updatedShifts = await db('shifts')
            .whereNull('end_time')
            .orWhere('status', 'active') 
            .update({
                end_time: currentTime, // Passes only the time (e.g., '08:55:49')
                status: 'completed', 
                updated_at: nowIso
            });

        console.log(`Successfully closed ${updatedShifts} active shifts.`);
        console.log('All waiters have been successfully cleared and are ready for the next shift!');

    } catch (error) {
        console.error('Error during waiter shift clearance:', error);
    } finally {
        // Close the database connection
        await db.destroy();
    }
}

clearAllWaiters();