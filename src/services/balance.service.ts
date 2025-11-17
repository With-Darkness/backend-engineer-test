import { Pool } from 'pg';
import { calculateAddressBalance, getAddressBalance } from 'src/db/queries';

/**
 * Get the balance for an address
 * 
 * This function calculates the balance from UTXOs (unspent outputs),
 * which is the source of truth according to the UTXO model.
 * 
 * Balance calculation:
 * - Balance = sum of all unspent outputs (UTXOs) for the address
 * - Each output represents value received by the address
 * - Each input (spending) marks an output as spent
 * - Unspent outputs = received - spent = current balance
 * 
 * @param pool - Database connection pool
 * @param address - The address to get balance for
 * @returns The balance of the address (sum of all unspent outputs)
 */
export async function getBalance(pool: Pool, address: string): Promise<number> {
  // Calculate balance directly from UTXOs (source of truth)
  return await calculateAddressBalance(pool, address);
}

/**
 * Get the balance from the cached address_balances table
 * This is faster but should be verified against calculateAddressBalance
 * 
 * @param pool - Database connection pool
 * @param address - The address to get balance for
 * @returns The cached balance of the address
 */
export async function getCachedBalance(pool: Pool, address: string): Promise<number> {
  return await getAddressBalance(pool, address);
}

