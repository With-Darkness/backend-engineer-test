import { Pool } from 'pg';
import { clearAllBlocks } from '../../src/db/queries';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env file if it exists
try {
  const envPath = join(process.cwd(), '.env');
  const envFile = readFileSync(envPath, 'utf-8');
  const envLines = envFile.split('\n');
  
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch (error) {
  // .env file doesn't exist or can't be read, that's okay
  // We'll use environment variables or defaults
}

let testPool: Pool | null = null;

async function initializeTestDatabase(pool: Pool) {
  // Create tables for blockchain indexer
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id VARCHAR(64) PRIMARY KEY,
      height INT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(64) PRIMARY KEY,
      block_id VARCHAR(64) REFERENCES blocks (id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inputs (
      id SERIAL PRIMARY KEY,
      transaction_id VARCHAR(64) REFERENCES transactions (id) ON DELETE CASCADE,
      spent_transaction_id VARCHAR(64) NOT NULL,
      spent_output_index INT NOT NULL,
      FOREIGN KEY (spent_transaction_id, spent_output_index) 
        REFERENCES outputs (transaction_id, output_index) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS address_balances (
      address VARCHAR(100) PRIMARY KEY,
      balance BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create indexes
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks (height);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_block ON transactions (block_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_outputs_transaction ON outputs (transaction_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_outputs_address ON outputs (address);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_outputs_spent ON outputs (spent);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_inputs_transaction ON inputs (transaction_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_inputs_spent_output ON inputs (spent_transaction_id, spent_output_index);`);
}

export async function setupTestDatabase(): Promise<Pool> {
  if (!testPool) {
    const databaseUrl = process.env.DATABASE_URL || 'postgres://myuser:mypassword@localhost:5432/mydatabase';
    
    // Debug: Log which DATABASE_URL is being used (without password)
    if (process.env.DATABASE_URL) {
      const urlWithoutPassword = databaseUrl.replace(/:[^:@]+@/, ':****@');
      console.log(`[Test Setup] Using DATABASE_URL: ${urlWithoutPassword}`);
    } else {
      console.log('[Test Setup] DATABASE_URL not found in environment, using default: postgres://myuser:****@localhost:5432/mydatabase');
    }
    
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is required. Please set it or ensure the database is running.\n' +
        'For Docker: docker-compose up -d db\n' +
        'Or set: export DATABASE_URL=postgres://myuser:mypassword@localhost:5432/mydatabase\n' +
        'Or create a .env file with: DATABASE_URL=postgres://myuser:mypassword@localhost:5432/mydatabase'
      );
    }

    testPool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000, // 5 second timeout
    });

    // Test connection
    try {
      await testPool.query('SELECT 1');
    } catch (error: any) {
      throw new Error(
        `Failed to connect to database at ${databaseUrl}\n` +
        `Error: ${error.message}\n\n` +
        `Make sure the database is running:\n` +
        `  docker-compose up -d db\n` +
        `Or set DATABASE_URL to your database connection string.`
      );
    }

    await initializeTestDatabase(testPool);
  }
  return testPool;
}

export async function cleanupTestDatabase(): Promise<void> {
  if (testPool) {
    await clearAllBlocks(testPool);
  }
}

export async function closeTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { blockRoutes } from '../../src/api/routes/block.routes';
import { balanceRoutes } from '../../src/api/routes/balance.routes';
import { initializeDatabase } from '../../src/db/index';

export async function createTestServer(): Promise<FastifyInstance> {
  // Initialize database first
  await initializeDatabase();
  
  const fastify = Fastify({ logger: false });
  
  fastify.get('/', async (request, reply) => {
    return { hello: 'world' };
  });
  
  // Register routes
  await fastify.register(blockRoutes);
  await fastify.register(balanceRoutes);
  
  // Start server on port 3000
  // Retry if port is in use (from previous test)
  let retries = 5;
  while (retries > 0) {
    try {
      await fastify.listen({
        port: 3000,
        host: '0.0.0.0'
      });
      break;
    } catch (error: any) {
      if (error.code === 'EADDRINUSE' && retries > 0) {
        // Port in use, wait and retry
        retries--;
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        throw error;
      }
    }
  }
  
  return fastify;
}

