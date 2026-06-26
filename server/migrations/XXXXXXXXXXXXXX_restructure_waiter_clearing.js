exports.up = async function(knex) {
  // Ensure table logs trace history cleanly
  const hasClearancesTable = await knex.schema.hasTable('waiter_clearances');
  if (!hasClearancesTable) {
    await knex.schema.createTable('waiter_clearances', function(table) {
      table.increments('id').primary();
      table.integer('staff_id').unsigned().notNullable().references('id').inTable('staff').onDelete('CASCADE');
      table.integer('cleared_by').unsigned().notNullable().references('id').inTable('staff').onDelete('RESTRICT');
      table.decimal('total_amount_cleared', 12, 2).notNullable();
      table.timestamp('cleared_at').defaultTo(knex.fn.now());
      table.string('notes').nullable();
    });
  }

  // Ensure is_cleared status columns are indexed for high performance tracking
  const hasOrdersCleared = await knex.schema.hasColumn('orders', 'is_cleared');
  if (!hasOrdersCleared) {
    await knex.schema.alterTable('orders', function(table) {
      table.boolean('is_cleared').defaultTo(false).index();
      table.timestamp('cleared_at').nullable();
      table.integer('cleared_by').unsigned().references('id').inTable('staff').onDelete('SET NULL');
    });
  }
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('waiter_clearances');
};