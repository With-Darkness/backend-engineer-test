/**
 * Comprehensive test suite for GET /balance/:address endpoint
 * 
 * Test Structure:
 * - Success Cases: Valid balance queries for various addresses
 * - Edge Cases: Addresses with no balance, addresses that don't exist
 * - Integration Cases: Balance changes after transactions
 * 
 * Each test:
 * - Sets up a clean database
 * - Creates blocks/transactions
 * - Queries balance
 * - Verifies the expected balance
 * - Cleans up after itself
 */

import { expect, test, beforeEach, afterEach } from 'bun:test';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase, createTestServer } from './helpers/test-setup';
import { testBlocks } from './helpers/block-helpers';

let fastify: any;
let pool: any;

// Helper function to send HTTP requests to the test server
async function sendRequest(method: string, url: string, body?: any) {
  const response = await fetch(`http://localhost:3000${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
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

test('GET /balance/:address - Balance after first block (coinbase)', async () => {
  // Create block 1: addr1 receives 10
  await sendRequest('POST', '/blocks', testBlocks.block1());

  // Check balance
  const response = await sendRequest('GET', '/balance/addr1');

  expect(response.statusCode).toBe(200);
  expect(response.json.balance).toBe(10);
});

test('GET /balance/:address - Balance after spending transaction', async () => {
  // Create block 1: addr1 receives 10
  await sendRequest('POST', '/blocks', testBlocks.block1());
  
  // Create block 2: addr1 spends 10, addr2 receives 4, addr3 receives 6
  await sendRequest('POST', '/blocks', testBlocks.block2());

  // Check balances
  const addr1Response = await sendRequest('GET', '/balance/addr1');
  const addr2Response = await sendRequest('GET', '/balance/addr2');
  const addr3Response = await sendRequest('GET', '/balance/addr3');

  expect(addr1Response.statusCode).toBe(200);
  expect(addr1Response.json.balance).toBe(0); // Spent all
  
  expect(addr2Response.statusCode).toBe(200);
  expect(addr2Response.json.balance).toBe(4);
  
  expect(addr3Response.statusCode).toBe(200);
  expect(addr3Response.json.balance).toBe(6);
});

test('GET /balance/:address - Balance after multiple transactions', async () => {
  // Create blocks 1, 2, 3
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());
  await sendRequest('POST', '/blocks', testBlocks.block3());

  // Check balances according to README example:
  // addr1: 0, addr2: 4, addr3: 0, addr4: 2, addr5: 2, addr6: 2
  const addr1Response = await sendRequest('GET', '/balance/addr1');
  const addr2Response = await sendRequest('GET', '/balance/addr2');
  const addr3Response = await sendRequest('GET', '/balance/addr3');
  const addr4Response = await sendRequest('GET', '/balance/addr4');
  const addr5Response = await sendRequest('GET', '/balance/addr5');
  const addr6Response = await sendRequest('GET', '/balance/addr6');

  expect(addr1Response.json.balance).toBe(0);
  expect(addr2Response.json.balance).toBe(4);
  expect(addr3Response.json.balance).toBe(0); // Spent in block 3
  expect(addr4Response.json.balance).toBe(2);
  expect(addr5Response.json.balance).toBe(2);
  expect(addr6Response.json.balance).toBe(2);
});

test('GET /balance/:address - Balance with multiple outputs to same address', async () => {
  // Create block 1: addr1 receives 10
  await sendRequest('POST', '/blocks', testBlocks.block1());
  
  // Create block 2: addr1 receives 4, addr3 receives 6
  await sendRequest('POST', '/blocks', testBlocks.block2());
  
  // Create a new block where addr1 receives more
  const block3 = testBlocks.block3();
  // Modify to send to addr1
  block3.transactions[0].outputs[0].address = 'addr1';
  block3.transactions[0].outputs[0].value = 2;
  await sendRequest('POST', '/blocks', block3);

  // Check addr1 balance: should have 0 (spent 10) + 2 (received) = 2
  const addr1Response = await sendRequest('GET', '/balance/addr1');
  expect(addr1Response.json.balance).toBe(2);
});

test('GET /balance/:address - Balance with multiple inputs combining outputs', async () => {
  // Create blocks 1, 2, 3
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());
  await sendRequest('POST', '/blocks', testBlocks.block3());

  // Create block 4 with multiple inputs (combining outputs from tx3)
  // blockWithMultipleInputs creates a block that combines tx3 outputs 1 and 2
  await sendRequest('POST', '/blocks', testBlocks.blockWithMultipleInputs(4));

  // Check balances
  // addr9 receives 4 (from combining tx3:1=2 and tx3:2=2)
  const addr9Response = await sendRequest('GET', '/balance/addr9');
  expect(addr9Response.json.balance).toBe(4); // Combined from tx3 outputs
  
  // Verify tx3 outputs 1 and 2 are spent
  const addr5Response = await sendRequest('GET', '/balance/addr5');
  const addr6Response = await sendRequest('GET', '/balance/addr6');
  expect(addr5Response.json.balance).toBe(0); // Spent
  expect(addr6Response.json.balance).toBe(0); // Spent
});

// ============================================
// EDGE CASES
// ============================================

test('GET /balance/:address - Address with no balance (never received)', async () => {
  // Don't create any blocks
  
  const response = await sendRequest('GET', '/balance/addr999');

  expect(response.statusCode).toBe(200);
  expect(response.json.balance).toBe(0);
});

test('GET /balance/:address - Address that spent all balance', async () => {
  // Create block 1: addr1 receives 10
  await sendRequest('POST', '/blocks', testBlocks.block1());
  
  // Create block 2: addr1 spends all 10
  await sendRequest('POST', '/blocks', testBlocks.block2());

  const response = await sendRequest('GET', '/balance/addr1');
  
  expect(response.statusCode).toBe(200);
  expect(response.json.balance).toBe(0);
});

test('GET /balance/:address - Address receives and then spends', async () => {
  // Create block 1: addr1 receives 10
  await sendRequest('POST', '/blocks', testBlocks.block1());
  
  // Verify initial balance
  let response = await sendRequest('GET', '/balance/addr1');
  expect(response.json.balance).toBe(10);
  
  // Create block 2: addr1 spends 10
  await sendRequest('POST', '/blocks', testBlocks.block2());
  
  // Verify balance after spending
  response = await sendRequest('GET', '/balance/addr1');
  expect(response.json.balance).toBe(0);
});

test('GET /balance/:address - Multiple addresses in same transaction', async () => {
  // Create block 1: addr1 receives 10
  await sendRequest('POST', '/blocks', testBlocks.block1());
  
  // Create block 2: splits to addr2 and addr3
  await sendRequest('POST', '/blocks', testBlocks.block2());

  // Both should have balances
  const addr2Response = await sendRequest('GET', '/balance/addr2');
  const addr3Response = await sendRequest('GET', '/balance/addr3');
  
  expect(addr2Response.json.balance).toBe(4);
  expect(addr3Response.json.balance).toBe(6);
  expect(addr2Response.json.balance + addr3Response.json.balance).toBe(10);
});

test('GET /balance/:address - Balance calculation from UTXOs', async () => {
  // Create a complex scenario
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());
  await sendRequest('POST', '/blocks', testBlocks.block3());
  await sendRequest('POST', '/blocks', testBlocks.block4());

  // Verify balances are calculated correctly from unspent outputs
  const addr2Response = await sendRequest('GET', '/balance/addr2');
  const addr4Response = await sendRequest('GET', '/balance/addr4');
  const addr5Response = await sendRequest('GET', '/balance/addr5');
  const addr6Response = await sendRequest('GET', '/balance/addr6');
  const addr7Response = await sendRequest('GET', '/balance/addr7');
  const addr8Response = await sendRequest('GET', '/balance/addr8');

  // addr2: 4 (from block2, spent in block4 by tx4a)
  expect(addr2Response.json.balance).toBe(0);
  
  // addr4: 2 (from block3, spent in block4 by tx4b)
  expect(addr4Response.json.balance).toBe(0);
  
  // addr5: 2 (from block3, not spent)
  expect(addr5Response.json.balance).toBe(2);
  
  // addr6: 2 (from block3, not spent)
  expect(addr6Response.json.balance).toBe(2);
  
  // addr7: 4 (from block4 tx4a, not spent)
  expect(addr7Response.json.balance).toBe(4);
  
  // addr8: 2 (from block4 tx4b, not spent)
  expect(addr8Response.json.balance).toBe(2);
});

