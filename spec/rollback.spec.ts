/**
 * Comprehensive test suite for POST /rollback?height=number endpoint
 * 
 * Test Structure:
 * - Success Cases: Valid rollback operations
 * - Edge Cases: Rollback to same height, rollback to height 0, rollback with no blocks
 * - Integration Cases: Balance verification after rollback
 * 
 * Each test:
 * - Sets up a clean database
 * - Creates blocks/transactions
 * - Performs rollback
 * - Verifies the expected state
 * - Cleans up after itself
 */

import { expect, test, beforeEach, afterEach } from 'bun:test';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase, createTestServer } from './helpers/test-setup';
import { testBlocks } from './helpers/block-helpers';

let fastify: any;
let pool: any;

// Helper function to send HTTP requests to the test server
async function sendRequest(method: string, url: string, body?: any) {
  const headers: Record<string, string> = {};
  
  // Only set Content-Type if there's a body
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(`http://localhost:3000${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  
  const responseBody = await response.text();
  let jsonBody: any;
  try {
    jsonBody = JSON.parse(responseBody);
  } catch {
    jsonBody = responseBody;
  }
  
  return {
    statusCode: response.status,
    status: response.status,
    body: responseBody,
    json: jsonBody
  };
}

beforeEach(async () => {
  pool = await setupTestDatabase();
  await cleanupTestDatabase();
  fastify = await createTestServer();
  // Wait a bit for server to be ready
  await new Promise(resolve => setTimeout(resolve, 200));
});

afterEach(async () => {
  await cleanupTestDatabase();
  if (fastify) {
    try {
      await fastify.close();
    } catch (error) {
      // Ignore errors when closing
    }
  }
  // Wait a bit for server to close and port to be released
  await new Promise(resolve => setTimeout(resolve, 300));
});

// ============================================
// SUCCESS CASES
// ============================================

test('POST /rollback - Rollback to height 2 (README example)', async () => {
  // Create blocks 1, 2, 3 as per README example
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());
  await sendRequest('POST', '/blocks', testBlocks.block3());

  // Verify state before rollback
  let addr1Response = await sendRequest('GET', '/balance/addr1');
  let addr2Response = await sendRequest('GET', '/balance/addr2');
  let addr3Response = await sendRequest('GET', '/balance/addr3');
  let addr4Response = await sendRequest('GET', '/balance/addr4');
  
  expect(addr1Response.json.balance).toBe(0);
  expect(addr2Response.json.balance).toBe(4);
  expect(addr3Response.json.balance).toBe(0);
  expect(addr4Response.json.balance).toBe(2);

  // Rollback to height 2
  const rollbackResponse = await sendRequest('POST', '/rollback?height=2');
  
  expect(rollbackResponse.statusCode).toBe(200);
  expect(rollbackResponse.json.message).toContain('Rollback to height 2');

  // Verify state after rollback (should match README: addr1=0, addr2=4, addr3=6)
  addr1Response = await sendRequest('GET', '/balance/addr1');
  addr2Response = await sendRequest('GET', '/balance/addr2');
  addr3Response = await sendRequest('GET', '/balance/addr3');
  addr4Response = await sendRequest('GET', '/balance/addr4');
  
  expect(addr1Response.json.balance).toBe(0);
  expect(addr2Response.json.balance).toBe(4);
  expect(addr3Response.json.balance).toBe(6); // Restored!
  expect(addr4Response.json.balance).toBe(0); // Block 3 deleted
});

test('POST /rollback - Rollback to height 1', async () => {
  // Create blocks 1, 2, 3
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());
  await sendRequest('POST', '/blocks', testBlocks.block3());

  // Rollback to height 1
  const rollbackResponse = await sendRequest('POST', '/rollback?height=1');
  
  expect(rollbackResponse.statusCode).toBe(200);

  // Verify only block 1 remains
  const addr1Response = await sendRequest('GET', '/balance/addr1');
  const addr2Response = await sendRequest('GET', '/balance/addr2');
  const addr3Response = await sendRequest('GET', '/balance/addr3');
  
  expect(addr1Response.json.balance).toBe(10); // Restored!
  expect(addr2Response.json.balance).toBe(0); // Block 2 deleted
  expect(addr3Response.json.balance).toBe(0); // Block 2 deleted
});

test('POST /rollback - Rollback single block', async () => {
  // Create blocks 1, 2
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());

  // Verify state
  let addr1Response = await sendRequest('GET', '/balance/addr1');
  expect(addr1Response.json.balance).toBe(0);

  // Rollback to height 1
  await sendRequest('POST', '/rollback?height=1');

  // Verify state restored
  addr1Response = await sendRequest('GET', '/balance/addr1');
  expect(addr1Response.json.balance).toBe(10);
});

test('POST /rollback - Rollback multiple blocks', async () => {
  // Create blocks 1, 2, 3, 4
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());
  await sendRequest('POST', '/blocks', testBlocks.block3());
  await sendRequest('POST', '/blocks', testBlocks.block4());

  // Rollback to height 2
  await sendRequest('POST', '/rollback?height=2');

  // Verify state
  const addr1Response = await sendRequest('GET', '/balance/addr1');
  const addr2Response = await sendRequest('GET', '/balance/addr2');
  const addr3Response = await sendRequest('GET', '/balance/addr3');
  const addr4Response = await sendRequest('GET', '/balance/addr4');
  const addr7Response = await sendRequest('GET', '/balance/addr7');
  
  expect(addr1Response.json.balance).toBe(0);
  expect(addr2Response.json.balance).toBe(4);
  expect(addr3Response.json.balance).toBe(6);
  expect(addr4Response.json.balance).toBe(0); // Block 3 deleted
  expect(addr7Response.json.balance).toBe(0); // Block 4 deleted
});

test('POST /rollback - Rollback with multiple transactions in block', async () => {
  // Create blocks 1, 2, 3, 4 (block 4 has multiple transactions)
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());
  await sendRequest('POST', '/blocks', testBlocks.block3());
  await sendRequest('POST', '/blocks', testBlocks.block4());

  // Verify state
  let addr7Response = await sendRequest('GET', '/balance/addr7');
  let addr8Response = await sendRequest('GET', '/balance/addr8');
  expect(addr7Response.json.balance).toBe(4);
  expect(addr8Response.json.balance).toBe(2);

  // Rollback to height 3 (deletes block 4)
  await sendRequest('POST', '/rollback?height=3');

  // Verify block 4 transactions are undone
  addr7Response = await sendRequest('GET', '/balance/addr7');
  addr8Response = await sendRequest('GET', '/balance/addr8');
  expect(addr7Response.json.balance).toBe(0);
  expect(addr8Response.json.balance).toBe(0);

  // Verify outputs spent in block 4 are restored
  const addr2Response = await sendRequest('GET', '/balance/addr2');
  const addr4Response = await sendRequest('GET', '/balance/addr4');
  expect(addr2Response.json.balance).toBe(4); // Restored (was spent in block 4)
  expect(addr4Response.json.balance).toBe(2); // Restored (was spent in block 4)
});

test('POST /rollback - Rollback restores spent outputs', async () => {
  // Create blocks 1, 2
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());

  // Verify addr1 spent output
  let addr1Response = await sendRequest('GET', '/balance/addr1');
  expect(addr1Response.json.balance).toBe(0);

  // Rollback to height 1
  await sendRequest('POST', '/rollback?height=1');

  // Verify output is restored (unspent)
  addr1Response = await sendRequest('GET', '/balance/addr1');
  expect(addr1Response.json.balance).toBe(10);
});

// ============================================
// EDGE CASES
// ============================================

test('POST /rollback - Rollback to height 0 (no blocks)', async () => {
  // Create blocks 1, 2
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());

  // Rollback to height 0
  const rollbackResponse = await sendRequest('POST', '/rollback?height=0');
  
  expect(rollbackResponse.statusCode).toBe(200);

  // Verify all blocks deleted
  const addr1Response = await sendRequest('GET', '/balance/addr1');
  expect(addr1Response.json.balance).toBe(0);
});

test('POST /rollback - Rollback when no blocks exist', async () => {
  // Don't create any blocks
  
  const rollbackResponse = await sendRequest('POST', '/rollback?height=1');
  
  expect(rollbackResponse.statusCode).toBe(200);
  // Should succeed without error
});

test('POST /rollback - Rollback to current height (no change)', async () => {
  // Create blocks 1, 2
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());

  // Rollback to height 2 (current height)
  const rollbackResponse = await sendRequest('POST', '/rollback?height=2');
  
  expect(rollbackResponse.statusCode).toBe(200);

  // Verify state unchanged
  const addr1Response = await sendRequest('GET', '/balance/addr1');
  const addr2Response = await sendRequest('GET', '/balance/addr2');
  expect(addr1Response.json.balance).toBe(0);
  expect(addr2Response.json.balance).toBe(4);
});

test('POST /rollback - Rollback to height greater than current (no change)', async () => {
  // Create blocks 1, 2
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());

  // Rollback to height 10 (greater than current)
  const rollbackResponse = await sendRequest('POST', '/rollback?height=10');
  
  expect(rollbackResponse.statusCode).toBe(200);

  // Verify state unchanged
  const addr1Response = await sendRequest('GET', '/balance/addr1');
  expect(addr1Response.json.balance).toBe(0);
});

test('POST /rollback - Rollback with complex transaction chain', async () => {
  // Create a chain: block1 -> block2 -> block3 -> block4
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());
  await sendRequest('POST', '/blocks', testBlocks.block3());
  await sendRequest('POST', '/blocks', testBlocks.block4());

  // Rollback to height 2
  await sendRequest('POST', '/rollback?height=2');

  // Verify all balances are correct
  const addr1Response = await sendRequest('GET', '/balance/addr1');
  const addr2Response = await sendRequest('GET', '/balance/addr2');
  const addr3Response = await sendRequest('GET', '/balance/addr3');
  const addr4Response = await sendRequest('GET', '/balance/addr4');
  const addr5Response = await sendRequest('GET', '/balance/addr5');
  const addr6Response = await sendRequest('GET', '/balance/addr6');
  const addr7Response = await sendRequest('GET', '/balance/addr7');
  const addr8Response = await sendRequest('GET', '/balance/addr8');

  expect(addr1Response.json.balance).toBe(0);
  expect(addr2Response.json.balance).toBe(4);
  expect(addr3Response.json.balance).toBe(6);
  expect(addr4Response.json.balance).toBe(0);
  expect(addr5Response.json.balance).toBe(0);
  expect(addr6Response.json.balance).toBe(0);
  expect(addr7Response.json.balance).toBe(0);
  expect(addr8Response.json.balance).toBe(0);
});

// ============================================
// VALIDATION FAILURE CASES
// ============================================

test('POST /rollback - Missing height parameter', async () => {
  const rollbackResponse = await sendRequest('POST', '/rollback');
  
  expect(rollbackResponse.statusCode).toBe(400);
  expect(rollbackResponse.json.error).toContain('Height query parameter is required');
});

test('POST /rollback - Invalid height (not a number)', async () => {
  const rollbackResponse = await sendRequest('POST', '/rollback?height=abc');
  
  expect(rollbackResponse.statusCode).toBe(400);
  expect(rollbackResponse.json.error).toContain('non-negative integer');
});

test('POST /rollback - Negative height', async () => {
  const rollbackResponse = await sendRequest('POST', '/rollback?height=-1');
  
  expect(rollbackResponse.statusCode).toBe(400);
  expect(rollbackResponse.json.error).toContain('non-negative integer');
});

