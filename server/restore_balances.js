// server/restore_balances.js
const knex = require('knex');
const knexConfig = require('./knexfile');
const db = knex(knexConfig.development || knexConfig);

async function rollbackClearance() {
  console.log('🔄 Initiating balance restoration for July 5, 2026...');

  // Operational window boundaries for June 25 (Local Kenyan Time context)
  const startTime = new Date('2026-07-05T00:00:00');
  const endTime = new Date('2026-07-05T23:59:59');

  try {
    await db.transaction(async (trx) => {
      // 1. Mark orders back to uncleared
      const updatedOrders = await trx('orders')
        .where('is_cleared', true)
        .whereBetween('created_at', [startTime, endTime])
        .update({
          is_cleared: false,
          cleared_at: null,
          cleared_by: null
        });
      console.log(`✅ Restored ${updatedOrders} orders back to UNCLEARED status.`);

      // 2. Mark expenses back to uncleared
      const updatedExpenses = await trx('expenses')
        .where('is_cleared', true)
        .whereBetween('created_at', [startTime, endTime])
        .update({
          is_cleared: false,
          cleared_at: null,
          cleared_by: null
        });
      console.log(`✅ Restored ${updatedExpenses} expenses back to UNCLEARED status.`);

      // 3. Mark room service transactions back to uncleared
      const updatedRooms = await trx('room_transactions')
        .where('is_cleared', true)
        .whereBetween('created_at', [startTime, endTime])
        .update({
          is_cleared: false,
          cleared_at: null,
          cleared_by: null
        });
      console.log(`✅ Restored ${updatedRooms} room transactions back to UNCLEARED status.`);

      // 4. Remove the clearance logs for this time bracket to correct historical analytics
      const deletedLogs = await trx('waiter_clearances')
        .whereBetween('cleared_at', [startTime, new Date()]); // matches logs since that time
      
      await trx('waiter_clearances')
        .whereBetween('cleared_at', [startTime, new Date()])
        .del();
      console.log(`🗑️ Removed ${deletedLogs.length} matching administrative clearance trace logs.`);
    });

    console.log('🎉 Restoration successful! Waiter balances have been re-pooled.');
  } catch (error) {
    console.error('❌ Reversal transaction aborted:', error);
  } finally {
    await db.destroy();
  }
}

rollbackClearance();