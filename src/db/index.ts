import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }
    pool = new Pool({
      connectionString: databaseUrl,
    });
  }
  return pool;
}

export async function initializeDatabase() {
  const dbPool = getPool();

  // Create tables for blockchain indexer
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id VARCHAR(64) PRIMARY KEY,
      height INT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(64) PRIMARY KEY,
      block_id VARCHAR(64) REFERENCES blocks (id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS outputs (
      id SERIAL PRIMARY KEY,
      transaction_id VARCHAR(64) REFERENCES transactions (id) ON DELETE CASCADE,
      output_index INT NOT NULL,
      address VARCHAR(100) NOT NULL,
      value BIGINT NOT NULL,
      spent BOOLEAN DEFAULT FALSE,
      UNIQUE(transaction_id, output_index)
    );
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS inputs (
      id SERIAL PRIMARY KEY,
      transaction_id VARCHAR(64) REFERENCES transactions (id) ON DELETE CASCADE,
      spent_transaction_id VARCHAR(64) NOT NULL,
      spent_output_index INT NOT NULL,
      FOREIGN KEY (spent_transaction_id, spent_output_index) 
        REFERENCES outputs (transaction_id, output_index) ON DELETE CASCADE
    );
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS address_balances (
      address VARCHAR(100) PRIMARY KEY,
      balance BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create indexes
  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks (height);
  `);

  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_block ON transactions (block_id);
  `);

  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_transaction ON outputs (transaction_id);
  `);

  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_address ON outputs (address);
  `);

  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_spent ON outputs (spent);
  `);

  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_inputs_transaction ON inputs (transaction_id);
  `);

  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_inputs_spent_output ON inputs (spent_transaction_id, spent_output_index);
  `);
}
