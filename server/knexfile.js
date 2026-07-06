const path = require('path');

// Load environment-specific configuration
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.join(__dirname, envFile) });

const isProduction = process.env.NODE_ENV === 'production';

console.log(`🌍 Knex Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 Database URL available: ${!!process.env.DATABASE_URL}`);

const baseConfig = {
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

module.exports = {
  development: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos_mocha_dev',
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 20,
      propagateCreateError: true
    },
    ...baseConfig,
    debug: true
  },
  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 20
    },
    ...baseConfig,
    debug: false
  }
};