import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import type { Block, Transaction, Input, Output } from 'src/types/block.types';

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

/**
 * Delete all blocks with height greater than the given height
 * This will cascade delete transactions, inputs, and outputs
 */
export async function deleteBlocksAboveHeight(
  pool: DbClient,
  height: number
): Promise<void> {
  await pool.query(`
    DELETE FROM blocks
    WHERE height > $1;
  `, [height]);
}

/**
 * Reset spent flag for outputs that were referenced by deleted inputs
 * When a transaction is deleted, its inputs are deleted, but the outputs
 * they referenced should become unspent again
 */
export async function resetSpentOutputs(pool: DbClient): Promise<void> {
  // Reset all outputs to unspent that are not referenced by any existing input
  await pool.query(`
    UPDATE outputs
    SET spent = FALSE
    WHERE spent = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM inputs
      WHERE inputs.spent_transaction_id = outputs.transaction_id
      AND inputs.spent_output_index = outputs.output_index
    );
  `);
}

/**
 * Recalculate all address balances from UTXOs
 * This is used after rollback to ensure balances are accurate
 */
export async function recalculateAllBalances(pool: DbClient): Promise<void> {
  // Delete all existing balances
  await pool.query(`DELETE FROM address_balances;`);
  
  // Recalculate balances from unspent outputs
  await pool.query(`
    INSERT INTO address_balances (address, balance, updated_at)
    SELECT 
      address,
      COALESCE(SUM(value), 0) as balance,
      NOW() as updated_at
    FROM outputs
    WHERE spent = FALSE
    GROUP BY address
    ON CONFLICT (address) 
    DO UPDATE SET 
      balance = EXCLUDED.balance,
      updated_at = NOW();
  `);
  
  // Also insert 0 balance for addresses that have no unspent outputs
  // (to ensure they show up as 0, not missing)
  // Actually, we don't need to do this - if an address has no unspent outputs,
  // calculateAddressBalance will return 0 anyway
}

