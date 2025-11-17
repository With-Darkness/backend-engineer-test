import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import type { Block, Transaction, Input, Output } from '../types/block.types';

type DbClient = Pool | PoolClient;

export async function getCurrentHeight(pool: DbClient): Promise<number | null> {
  const result = await pool.query(`
    SELECT MAX(height) as max_height FROM blocks;
  `);
  return result.rows[0]?.max_height ?? null;
}

export async function getOutputValue(
  pool: DbClient,
  txId: string,
  index: number
): Promise<number | null> {
  const result = await pool.query(`
    SELECT value, spent FROM outputs
    WHERE transaction_id = $1 AND output_index = $2;
  `, [txId, index]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  if (result.rows[0].spent) {
    throw new Error(`Output ${txId}:${index} has already been spent`);
  }
  
  return Number(result.rows[0].value);
}

export async function getOutputAddress(
  pool: DbClient,
  txId: string,
  index: number
): Promise<string | null> {
  const result = await pool.query(`
    SELECT address FROM outputs
    WHERE transaction_id = $1 AND output_index = $2;
  `, [txId, index]);
  
  return result.rows[0]?.address ?? null;
}

export async function insertBlock(
  pool: DbClient,
  blockId: string,
  height: number
): Promise<void> {
  await pool.query(`
    INSERT INTO blocks (id, height)
    VALUES ($1, $2);
  `, [blockId, height]);
}

export async function insertTransaction(
  pool: DbClient,
  transactionId: string,
  blockId: string
): Promise<void> {
  await pool.query(`
    INSERT INTO transactions (id, block_id)
    VALUES ($1, $2);
  `, [transactionId, blockId]);
}

export async function insertOutput(
  pool: DbClient,
  transactionId: string,
  outputIndex: number,
  address: string,
  value: number
): Promise<void> {
  await pool.query(`
    INSERT INTO outputs (transaction_id, output_index, address, value, spent)
    VALUES ($1, $2, $3, $4, FALSE)
    ON CONFLICT (transaction_id, output_index) DO NOTHING;
  `, [transactionId, outputIndex, address, value]);
}

export async function insertInput(
  pool: DbClient,
  transactionId: string,
  spentTransactionId: string,
  spentOutputIndex: number
): Promise<void> {
  await pool.query(`
    INSERT INTO inputs (transaction_id, spent_transaction_id, spent_output_index)
    VALUES ($1, $2, $3);
  `, [transactionId, spentTransactionId, spentOutputIndex]);
}

export async function markOutputAsSpent(
  pool: DbClient,
  transactionId: string,
  outputIndex: number
): Promise<void> {
  await pool.query(`
    UPDATE outputs
    SET spent = TRUE
    WHERE transaction_id = $1 AND output_index = $2;
  `, [transactionId, outputIndex]);
}

export async function updateAddressBalance(
  pool: DbClient,
  address: string,
  delta: number
): Promise<void> {
  await pool.query(`
    INSERT INTO address_balances (address, balance, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (address) 
    DO UPDATE SET 
      balance = address_balances.balance + $2,
      updated_at = NOW();
  `, [address, delta]);
}

/**
 * Get balance from cached address_balances table
 * This is fast but relies on the balance being kept in sync
 */
export async function getAddressBalance(
  pool: DbClient,
  address: string
): Promise<number> {
  const result = await pool.query(`
    SELECT balance FROM address_balances
    WHERE address = $1;
  `, [address]);
  
  return result.rows[0]?.balance ? Number(result.rows[0].balance) : 0;
}

/**
 * Calculate balance directly from UTXOs (unspent outputs)
 * This is the source of truth: balance = sum of all unspent outputs for an address
 * 
 * According to UTXO model:
 * - Each output means an address received value
 * - Each input means an output was spent
 * - Balance = sum of all outputs received minus sum of all outputs spent
 * - Which equals: sum of all unspent outputs (UTXOs)
 */
export async function calculateAddressBalance(
  pool: DbClient,
  address: string
): Promise<number> {
  const result = await pool.query(`
    SELECT COALESCE(SUM(value), 0) as balance
    FROM outputs
    WHERE address = $1 AND spent = FALSE;
  `, [address]);
  
  return Number(result.rows[0]?.balance || 0);
}

export async function processBlockTransaction(
  pool: DbClient,
  transaction: Transaction,
  blockId: string
): Promise<void> {
  // Insert transaction
  await insertTransaction(pool, transaction.id, blockId);

  // Process inputs (spend outputs)
  for (const input of transaction.inputs) {
    // Get the output being spent
    const outputValue = await getOutputValue(pool, input.txId, input.index);
    if (outputValue === null) {
      throw new Error(`Output ${input.txId}:${input.index} does not exist`);
    }

    const outputAddress = await getOutputAddress(pool, input.txId, input.index);
    if (!outputAddress) {
      throw new Error(`Output ${input.txId}:${input.index} address not found`);
    }

    // Mark output as spent
    await markOutputAsSpent(pool, input.txId, input.index);

    // Insert input record
    await insertInput(pool, transaction.id, input.txId, input.index);

    // Decrease balance for the address that owned the output
    await updateAddressBalance(pool, outputAddress, -outputValue);
  }

  // Process outputs (create new UTXOs)
  for (let i = 0; i < transaction.outputs.length; i++) {
    const output = transaction.outputs[i];
    await insertOutput(pool, transaction.id, i, output.address, output.value);
    
    // Increase balance for the address receiving the output
    await updateAddressBalance(pool, output.address, output.value);
  }
}

export async function clearAllBlocks(pool: DbClient): Promise<void> {
  // Delete all blocks (cascade will delete transactions, inputs, outputs)
  await pool.query(`DELETE FROM blocks;`);
  
  // Reset all address balances
  await pool.query(`DELETE FROM address_balances;`);
  
  // Reset all outputs to unspent (in case there are orphaned outputs)
  await pool.query(`UPDATE outputs SET spent = FALSE;`);
}

