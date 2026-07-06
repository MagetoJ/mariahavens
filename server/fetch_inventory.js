// server/fetch_inventory.js
const knex = require('knex');
const knexConfig = require('./knexfile');

// Initialize database using the active environment configuration
const db = knex(knexConfig.development || knexConfig);

async function fetchCurrentInventory() {
  console.log('🚀 Fetching current data from inventory_items...');

  try {
    // Check if the inventory_items table exists first
    const tableExists = await db.schema.hasTable('inventory_items');
    if (!tableExists) {
      console.error('❌ Error: The table "inventory_items" does not exist in the database.');
      return;
    }

    // Retrieve all active items grouped by type or simply listed
    const items = await db('inventory_items')
      .select('*')
      .orderBy('inventory_type', 'asc')
      .orderBy('name', 'asc');

    if (items.length === 0) {
      console.log('⚠️ The inventory_items table is currently empty.');
      return;
    }

    console.log(`\n📊 Found ${items.length} total inventory items:\n`);
    console.table(items.map(item => ({
      ID: item.id,
      Name: item.name,
      Type: item.inventory_type || 'N/A',
      Stock: `${item.current_stock} ${item.unit}`,
      'Min Stock': item.minimum_stock,
      'Cost/Unit': item.cost_per_unit || item.buying_price || 0,
      'Selling Price': item.selling_price || 'N/A',
      Status: item.is_active ? 'Active' : 'Inactive'
    })));

  } catch (error) {
    console.error('❌ Failed to retrieve inventory data:', error);
  } finally {
    // Safely close the database connection pool
    await db.destroy();
    console.log('\n⚡ Database pool connection disconnected.');
  }
}

fetchCurrentInventory();