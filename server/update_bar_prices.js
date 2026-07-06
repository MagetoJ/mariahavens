// server/update_bar_prices.js
const knex = require('knex');
const knexConfig = require('./knexfile');
const db = knex(knexConfig.development || knexConfig);

// Extracted verified prices from the MARIA HAVENS BAR STOCK SHEET PDF
const barPrices = {
  // --- BEERS & CIDERS ---
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

  // --- BEER/CIDER CANS ---
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

  // --- WHISKEY ---
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

  // --- COGNACS ---
  "HENNESSY VS": 12000,
  "HENNESSY VSOP": 18000,
  "MARTEL VS": 12000,
  "MARTEL VSOP": 14000,
  "REMY MARTIN VS": 12000,
  "REMY MARTIN VSOP": 15000,

  // --- GIN ---
  "GILBEYS 750ML.": 2500,
  "GILBEYS 350 ML": 1500,
  "GORDONS 1L": 4000,
  "GORDONS MIXED BERRY": 4000,
  "HENDRICKS": 5000,
  "TANQUERAY 10": 7500,
  "TANQUERAY LONDON": 7000,

  // --- TEQUILA ---
  "CAMINO GOLD": 3800,
  "CAMINO SILVER": 3600,
  "DON JULIO": 12000,
  "JOSE CUERVO GOLD 750ML": 4200,
  "JOSE CUERVO GOLD 1L": 4500,
  "JOSE CUERVO SILVER": 4000,

  // --- BRANDY ---
  "VICEROY 750 ML": 2500,
  "VICEROY 375ML": 1500,
  "RICHOT 750ML": 2500,
  "RICHOT 375ML": 1500,

  // --- LIQUEUR ---
  "AMARULA 750ML": 3000,
  "AMARULA 375ML": 2200,
  "BAIEYS CREAM 1L": 5500,
  "SOUTHERN COMFORT": 4000,
  "BAILEYS 375ML": 2500,
  "JAGERMEISTER 1000ML": 5000,
  "JAGERMEISTER 750ML": 4000,

  // --- RUM & OTHERS ---
  "KENYA CANE 250ML": 400,
  "KENYA CANE 350ML": 800,
  "KENYA CANE 750ML": 1200,
  "KONYAGI": 1850,
  "SMIRNOFF 1L": 3500,
  "SMIRNOFF VODKA 750ML": 2500,

  // --- WINES ---
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

  // --- SOFT DRINKS / UTILITIES ---
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

async function executePriceSync() {
  console.log('🚀 Starting menu product & inventory pricing database sync script...');

  try {
    await db.transaction(async (trx) => {
      let productUpdates = 0;
      let inventoryUpdates = 0;

      // Perform the schema check within the transaction context (or just before) safely
      const hasSellingPriceCol = await trx.schema.hasColumn('inventory_items', 'selling_price');

      for (const [itemName, targetPrice] of Object.entries(barPrices)) {
        // 1. Update POS Menu Products table using the trx object
        const pCount = await trx('products')
          .whereRaw('LOWER(name) = ?', [itemName.toLowerCase()])
          .update({
            price: targetPrice,
            updated_at: new Date()
          });
        productUpdates += pCount;

        // 2. Update Inventory Table selling price metrics if column structure exists
        if (hasSellingPriceCol) {
          const iCount = await trx('inventory_items')
            .whereRaw('LOWER(name) = ?', [itemName.toLowerCase()])
            .update({
              selling_price: targetPrice,
              updated_at: new Date()
            });
          inventoryUpdates += iCount;
        }
      }

      console.log(`\n✅ Transaction committed successfully!`);
      console.log(`🔹 Updated ${productUpdates} active POS menu products.`);
      if (hasSellingPriceCol) {
        console.log(`🔹 Synchronized ${inventoryUpdates} linked bar inventory tracking records.`);
      }
    });

  } catch (error) {
    console.error('❌ Price sync aborted due to error:', error);
  } finally {
    await db.destroy();
    console.log('⚡ Database pool connection disconnected.');
  }
}

executePriceSync();