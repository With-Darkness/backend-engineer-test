import { Pool } from "pg";
import { calculateAddressBalance, getAddressBalance } from "src/db/queries";

/**
 * Get the balance for an address
 */
export async function getBalance(pool: Pool, address: string): Promise<number> {
  return await calculateAddressBalance(pool, address);
}

/**
 * Get the balance from the cached address_balances table
 */
export async function getCachedBalance(
  pool: Pool,
  address: string
): Promise<number> {
  return await getAddressBalance(pool, address);
}
