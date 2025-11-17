import { createHash } from 'crypto';
import { Pool } from 'pg';
import type { Block } from '../types/block.types';
import {
  getCurrentHeight,
  getOutputValue,
  insertBlock,
  processBlockTransaction,
} from '../db/queries';

export class BlockValidationError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'BlockValidationError';
  }
}

export async function validateBlock(pool: Pool, block: Block): Promise<void> {
  // Validation 1: Height must be exactly one unit higher than current height
  const currentHeight = await getCurrentHeight(pool);
  const expectedHeight = currentHeight === null ? 1 : currentHeight + 1;
  
  if (block.height !== expectedHeight) {
    throw new BlockValidationError(
      `Invalid block height. Expected ${expectedHeight}, got ${block.height}`,
      400
    );
  }

  // Validation 2: Sum of input values must equal sum of output values
  // Each input is a reference to an output of a previous transaction
  // We need to look up the value of the referenced output
  // Also check for double-spending (same output referenced multiple times)
  let totalInputValue = 0;
  let totalOutputValue = 0;
  const spentOutputs = new Set<string>();

  for (const transaction of block.transactions) {
    // Calculate total output value for this transaction
    const transactionOutputValue = transaction.outputs.reduce(
      (sum, output) => sum + output.value,
      0
    );
    totalOutputValue += transactionOutputValue;

    // Calculate total input value by looking up referenced outputs
    let transactionInputValue = 0;
    for (const input of transaction.inputs) {
      const outputKey = `${input.txId}:${input.index}`;
      
      // Check if this output is already being spent in this block (double-spend prevention)
      if (spentOutputs.has(outputKey)) {
        throw new BlockValidationError(
          `Double-spend detected: output ${outputKey} is referenced multiple times in this block`,
          400
        );
      }
      spentOutputs.add(outputKey);

      // Look up the value of the output referenced by this input
      try {
        const referencedOutputValue = await getOutputValue(pool, input.txId, input.index);
        if (referencedOutputValue === null) {
          throw new BlockValidationError(
            `Input references non-existent output: ${input.txId}:${input.index}`,
            400
          );
        }
        transactionInputValue += referencedOutputValue;
      } catch (error) {
        // If output is already spent, convert to BlockValidationError
        if (error instanceof Error && error.message.includes('already been spent')) {
          throw new BlockValidationError(
            `Input references already spent output: ${input.txId}:${input.index}`,
            400
          );
        }
        // Re-throw BlockValidationError as-is
        if (error instanceof BlockValidationError) {
          throw error;
        }
        // Re-throw other errors
        throw error;
      }
    }
    totalInputValue += transactionInputValue;

    // For each transaction: if it has inputs, the sum of input values must equal sum of output values
    // Transactions with no inputs are allowed (they create new coins, like the first block)
    if (transaction.inputs.length > 0 && transactionInputValue !== transactionOutputValue) {
      throw new BlockValidationError(
        `Input/output sum mismatch for transaction ${transaction.id}. Inputs: ${transactionInputValue}, Outputs: ${transactionOutputValue}`,
        400
      );
    }
  }

  // Validation 3: Block ID must be sha256(height + transaction1.id + transaction2.id + ...)
  const transactionIds = block.transactions
    .map((tx) => tx.id)
    .sort() // Sort to ensure consistent ordering
    .join('');
  
  const blockIdInput = `${block.height}${transactionIds}`;
  const expectedBlockId = createHash('sha256')
    .update(blockIdInput)
    .digest('hex');

  if (block.id !== expectedBlockId) {
    throw new BlockValidationError(
      `Invalid block ID. Expected ${expectedBlockId}, got ${block.id}`,
      400
    );
  }
}

export async function processBlock(pool: Pool, block: Block): Promise<void> {
  // Validate block first
  await validateBlock(pool, block);

  // Start transaction for atomicity
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Insert block
    await insertBlock(client, block.id, block.height);

    // Process each transaction
    for (const transaction of block.transactions) {
      await processBlockTransaction(client, transaction, block.id);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

