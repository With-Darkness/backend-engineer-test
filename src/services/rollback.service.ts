import { Pool } from 'pg';
import { getCurrentHeight, deleteBlocksAboveHeight, resetSpentOutputs, recalculateAllBalances } from 'src/db/queries';
import { RollbackError } from 'src/utils/errors';

/**
 * Rollback the blockchain indexer to a specific height
 * 
 * This will:
 * 1. Delete all blocks with height > targetHeight (cascade deletes transactions, inputs, outputs)
 * 2. Reset spent flags for outputs that are no longer referenced by inputs
 * 3. Recalculate all address balances from remaining UTXOs
 */
export async function rollbackToHeight(pool: Pool, targetHeight: number): Promise<void> {
  // Validate target height
  if (targetHeight < 0) {
    throw new RollbackError('Target height must be non-negative');
  }

  const currentHeight = await getCurrentHeight(pool);
  
  // If no blocks exist, nothing to rollback
  if (currentHeight === null) {
    return;
  }

  // If target height is greater than or equal to current height, nothing to rollback
  if (targetHeight >= currentHeight) {
    return;
  }

  // Start transaction for atomicity
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Step 1: Delete all blocks with height > targetHeight
    // This will cascade delete:
    // - Transactions in those blocks
    // - Inputs in those transactions
    // - Outputs created in those transactions
    await deleteBlocksAboveHeight(client, targetHeight);

    // Step 2: Reset spent flags for outputs that were referenced by deleted inputs
    // When inputs are deleted, the outputs they referenced should become unspent
    await resetSpentOutputs(client);

    // Step 3: Recalculate all address balances from remaining UTXOs
    await recalculateAllBalances(client);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

