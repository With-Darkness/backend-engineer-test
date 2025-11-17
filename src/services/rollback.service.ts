import { Pool } from "pg";
import {
  getCurrentHeight,
  deleteBlocksAboveHeight,
  resetSpentOutputs,
  recalculateAllBalances,
} from "src/db/queries";
import { RollbackError } from "src/utils/errors";

/**
 * Rollback the blockchain indexer to a specific height
 */
export async function rollbackToHeight(
  pool: Pool,
  targetHeight: number
): Promise<void> {
  if (targetHeight < 0) {
    throw new RollbackError("Target height must be non-negative");
  }

  const currentHeight = await getCurrentHeight(pool);

  if (currentHeight === null) {
    return;
  }

  if (targetHeight >= currentHeight) {
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await deleteBlocksAboveHeight(client, targetHeight);

    await resetSpentOutputs(client);

    await recalculateAllBalances(client);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
