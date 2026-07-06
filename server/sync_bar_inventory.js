// server/sync_bar_inventory.js
const knex = require('knex');
const knexConfig = require('./knexfile');
const db = knex(knexConfig.development || knexConfig);

const barPrices = {
  // ... (Keep your barPrices object exactly as it is)
  "TUSKER LAGER": 300,
  "TUSKER MALT": 300,
  "TUSKER LITE": 300,
  "KB LAGER": 300,
  "SUMMIT LAGER": 300,
  "WHITECAP": 300,
  "WHITECAP CRISP": 300,
  "GUINNESS": 300,
  "PILSNER LAGER": 300,
  "BALOZI": 300,
  "BLACK ICE": 300,
  "HEINEKEN": 350,
  "HEINEKEN ZERO": 350,
  "TUSKER NDIMU": 300,
  "SNAPP": 300,
  "TUSKER CIDER": 300,
  "KINGFISHER": 350,
  "MANYATTA": 350,
  "DESPERADO": 350,
  "SAVANNA DRY": 350,
  "KO CIDER": 350,
  "PINEAPPLE PUNCH": 350,
  "HUNTERS GOLD": 350,
  "HUNTERS DRY": 350,
  "WHITECAP CAN": 350,
  "GUINNESS CAN": 350,
  "TUSKER LAGER CAN": 350,
  "TUSKER MALT CAN": 350,
  "TUSKER LITE CAN": 350,
  "PILSNER CAN": 350,
  "PINEAPPLE PUNCH CAN": 350,
  "ALVARO CAN": 200,
  "SNAPP CAN": 350,
  "BALOZI CANS": 350,
  "TUSKER CIDER CAN": 350,
  "HEINEKEN CAN": 350,
  "BLACK ICE CAN": 350,
  "GUARANA": 350,
  "J.W. DOUBLE BLACK": 8000,
  "J. W. BLACK 750ML": 5000,
  "J. W. BLACK 1000ML": 6500,
  "J.W. BLACK 375ML": 2800,
  "J.W.RED 750ML": 3300,
  "J.W.RED 1000ML": 4500,
  "J.W.RED 375ML": 1800,
  "J. GOLD 750ML": 10000,
  "J.W. GREEN 750ML": 9800,
  "J.W. BLONDE": 3500,
  "SINGLETON 12YRS": 7500,
  "SINGLETON 15YRS": 9500,
  "GLENFIDDICH 12YRS": 12000,
  "GLENFIDDICH 15YRS": 12500,
  "JAMESON 750ML": 4000,
  "JAMESON 1L": 5000,
  "GRANTS 750ML": 3500,
  "GRANTS 1L": 4000,
  "FAMOUS GROUSE 1L": 4000,
  "BOND 7 750ML": 2500,
  "JACK DANIELS 750ML": 6000,
  "JACK DANIELS 1000ML": 7200,
  "JACK DANIELS 350ML": 3000,
  "BLACK AND WHITE 375ML": 1500,
  "BLACK AND WHITE 750ML": 2200,
  "BLACK LEBEL 375ML": 2700,
  "RED LEBEL 375ML": 1800,
  "VAT 69 750ML": 3000,
  "VAT 69 375ML": 1500,
  "CHIVAS REGAL 750ML": 6000,
  "HENNESSY VS": 12000,
  "HENNESSY VSOP": 18000,
  "MARTEL VS": 12000,
  "MARTEL VSOP": 14000,
  "REMY MARTIN VS": 12000,
  "REMY MARTIN VSOP": 15000,
  "GILBEYS 750ML.": 2500,
  "GILBEYS 350 ML": 1500,
  "GORDONS 1L": 4000,
  "GORDONS MIXED BERRY": 4000,
  "HENDRICKS": 5000,
  "TANQUERAY 10": 7500,
  "TANQUERAY LONDON": 7000,
  "CAMINO GOLD": 3800,
  "CAMINO SILVER": 3600,
  "DON JULIO": 12000,
  "JOSE CUERVO GOLD 750ML": 4200,
  "JOSE CUERVO GOLD 1L": 4500,
  "JOSE CUERVO SILVER": 4000,
  "VICEROY 750 ML": 2500,
  "VICEROY 375ML": 1500,
  "RICHOT 750ML": 2500,
  "RICHOT 375ML": 1500,
  "AMARULA 750ML": 3000,
  "AMARULA 375ML": 2200,
  "BAIEYS CREAM 1L": 5500,
  "SOUTHERN COMFORT": 4000,
  "BAILEYS 375ML": 2500,
  "JAGERMEISTER 1000ML": 5000,
  "JAGERMEISTER 750ML": 4000,
  "KENYA CANE 250ML": 400,
  "KENYA CANE 350ML": 800,
  "KENYA CANE 750ML": 1200,
  "KONYAGI": 1850,
  "SMIRNOFF 1L": 3500,
  "SMIRNOFF VODKA 750ML": 2500,
  "CELLAR CASK RED": 2000,
  "CELLAR CASK WHITE": 2000,
  "4TH STREET RED 750ML": 2000,
  "4TH STREET WHITE 750ML": 2000,
  "4TH STREET ROSE": 2000,
  "FRONTERA": 2500,
  "DROSTYHOF WHITE 750ML": 3000,
  "DROSTYHOF RED 750ML": 3000,
  "ASCONI WHITE": 3000,
  "ASCONI RED 750ML": 3000,
  "NEDERBERG CAB SAUV": 3000,
  "FOUR COUSINS RED": 2000,
  "FOUR COUSINS WHITE": 2000,
  "ROBERTSON 750ML": 3000,
  "BALLENTINE 1L": 4000,
  "BELLAIRE GOLD 750ML": 15000,
  "BELAIRE ROSE 750 ML": 15000,
  "ROSSO NOBILE": 3000,
  "HUMPTON": 4000,
  "ROBERTSON WINERY 750ML": 3000,
  "MARTEL BLUE SWIFT": 14000,
  "REDBULL": 300,
  "ALVARO": 200,
  "DELMONTE": 500,
  "LEMONADE": 100,
  "TONIC": 150,
  "LIME 750ML": 400,
  "SODA WATER": 150,
  "SODA": 100,
  "SPARKLING WATER": 250,
  "KERINGET 1L": 200,
  "QUENCHER 1L": 150,
  "MARA MOJA": 20,
  "TRUST KISS CLASSIC": 150,
  "TRUST KISS STUDDED": 200,
  "TRUST CLASSIC": 150,
  "TRUST STUDDED": 180
};

function canonicalize(str) {
  return str.toLowerCase().replace(/[\s\.\-\(\)]/g, '');
}

async function runInventoryUpdate() {
  console.log('🚀 Starting smart pricing synchronization and insert script...');

  try {
    // --- SEQUENCE RE-SYNC STEP ---
    // Safely sync the primary key sequences to prevent any ID collision errors
    console.log('🔄 Re-syncing primary key auto-increment sequences...');
    await db.raw("SELECT setval('products_id_seq', COALESCE((SELECT MAX(id)+1 FROM products), 1), false);");
    await db.raw("SELECT setval('inventory_items_id_seq', COALESCE((SELECT MAX(id)+1 FROM inventory_items), 1), false);");
    console.log('✅ Sequences successfully synchronized!');

    // 1. Fetch current database snapshot for inventory entries
    const existingInventory = await db('inventory_items').select('id', 'name', 'selling_price');
    
    const dbMap = {};
    existingInventory.forEach(item => {
      const key = canonicalize(item.name);
      if (!dbMap[key]) dbMap[key] = [];
      dbMap[key].push(item);
    });

    await db.transaction(async (trx) => {
      let updatedCount = 0;
      let insertedCount = 0;

      for (const [targetName, targetPrice] of Object.entries(barPrices)) {
        const canonicalTarget = canonicalize(targetName);
        const matches = dbMap[canonicalTarget];

        if (matches && matches.length > 0) {
          // EXISTING PRODUCT: Update Selling Price
          for (const matchedItem of matches) {
            await trx('inventory_items')
              .where({ id: matchedItem.id })
              .update({
                selling_price: targetPrice,
                updated_at: new Date()
              });

            await trx('products')
              .whereRaw('LOWER(name) = ?', [matchedItem.name.toLowerCase()])
              .update({
                price: targetPrice,
                updated_at: new Date()
              });
              
            updatedCount++;
          }
        } else {
          // MISSING PRODUCT: Insert cleanly
          console.log(`➕ Item missing: "${targetName}". Inserting into database entries...`);

          await trx('inventory_items')
            .insert({
              name: targetName,
              inventory_type: 'bar',
              unit: targetName.toLowerCase().includes('can') ? 'pcs' : 'bottles',
              current_stock: 0,
              minimum_stock: 0,
              cost_per_unit: 0,
              selling_price: targetPrice,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            });

          await trx('products')
            .insert({
              name: targetName,
              price: targetPrice,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            });

          insertedCount++;
        }
      }

      console.log(`\n✅ Database Transaction Committed Cleanly!`);
      console.log(`🔹 Updated selling prices for ${updatedCount} matching records.`);
      console.log(`🔹 Inserted ${insertedCount} missing items into system configurations.`);
    });

  } catch (error) {
    console.error('❌ Synchronizer execution script failed:', error);
  } finally {
    await db.destroy();
    console.log('⚡ Connection pool released successfully.');
  }
}

runInventoryUpdate();