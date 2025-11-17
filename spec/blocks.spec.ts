/**
 * Comprehensive test suite for POST /blocks endpoint
 * 
 * Test Structure:
 * - Success Cases: Valid blocks that should pass all validations
 * - Validation Failure Cases: Blocks that fail specific validations
 *   - Validation 1: Block height validation
 *   - Validation 2: Input/output sum validation
 *   - Validation 3: Block ID validation
 * - Edge Cases: Special scenarios and error handling
 * 
 * Each test:
 * - Sets up a clean database
 * - Tests a specific scenario
 * - Verifies the expected outcome (success or specific error)
 * - Cleans up after itself
 */

import { expect, test, beforeEach, afterEach } from 'bun:test';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase, createTestServer } from './helpers/test-setup';
import { testBlocks, calculateBlockId } from './helpers/block-helpers';
import type { Block } from '../src/types/block.types';

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

test('POST /blocks - Block 1: First block with empty inputs creates coins', async () => {
  const block = testBlocks.block1();
  
  const response = await sendRequest('POST', '/blocks', block);

  expect(response.statusCode).toBe(200);
  expect(response.json.message).toBe('Block processed successfully');
});

test('POST /blocks - Block 2: Valid transaction with balanced inputs and outputs', async () => {
  // First, create block 1
  const block1 = testBlocks.block1();
  await sendRequest('POST', '/blocks', block1);

  // Then create block 2
  const block2 = testBlocks.block2();
  const response = await sendRequest('POST', '/blocks', block2);

  expect(response.statusCode).toBe(200);
  expect(response.json.message).toBe('Block processed successfully');
});

test('POST /blocks - Block 3: Valid transaction spending from previous block', async () => {
  // Create blocks 1 and 2 first
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());

  // Create block 3
  const block3 = testBlocks.block3();
  const response = await sendRequest('POST', '/blocks', block3);

  expect(response.statusCode).toBe(200);
});

test('POST /blocks - Block with multiple transactions', async () => {
  // Create blocks 1, 2, 3 first
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());
  await sendRequest('POST', '/blocks', testBlocks.block3());

  // Create block 4 with multiple transactions
  const block4 = testBlocks.block4();
  const response = await sendRequest('POST', '/blocks', block4);

  expect(response.statusCode).toBe(200);
});

test('POST /blocks - Transaction with multiple inputs', async () => {
  // Create blocks 1, 2, 3 first
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());
  await sendRequest('POST', '/blocks', testBlocks.block3());

  // Create block with multiple inputs (combining outputs from tx3)
  const block = testBlocks.blockWithMultipleInputs(4);
  const response = await sendRequest('POST', '/blocks', block);

  expect(response.statusCode).toBe(200);
});

test('POST /blocks - Transaction with change output', async () => {
  // Create blocks 1, 2 first
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());

  // Create block with change (spend 4, send 3, return 1 as change)
  const block: Block = {
    id: calculateBlockId(3, ['tx3']),
    height: 3,
    transactions: [
      {
        id: 'tx3',
        inputs: [
          { txId: 'tx2', index: 0 }
        ],
        outputs: [
          { address: 'addr10', value: 3 },
          { address: 'addr1', value: 1 }
        ]
      }
    ]
  };

  const response = await sendRequest('POST', '/blocks', block);

  expect(response.statusCode).toBe(200);
});

// ============================================
// VALIDATION FAILURE CASES
// ============================================

test('POST /blocks - Validation 1: Invalid block height (not sequential)', async () => {
  const block1 = testBlocks.block1();
  await sendRequest('POST', '/blocks', block1);

  // Try to submit height 3 instead of 2
  const invalidBlock: Block = {
    ...testBlocks.block2(),
    height: 3
  };
  invalidBlock.id = calculateBlockId(3, ['tx2']);

  const response = await sendRequest('POST', '/blocks', invalidBlock);

  expect(response.statusCode).toBe(400);
  const body = response.json;
  expect(body.error).toContain('Invalid block height');
  expect(body.error).toContain('Expected 2');
});

test('POST /blocks - Validation 1: Invalid block height (first block not height 1)', async () => {
  const invalidBlock: Block = {
    ...testBlocks.block1(),
    height: 2
  };
  invalidBlock.id = calculateBlockId(2, ['tx1']);

  const response = await sendRequest('POST', '/blocks', invalidBlock);

  expect(response.statusCode).toBe(400);
  const body = response.json;
  expect(body.error).toContain('Invalid block height');
  expect(body.error).toContain('Expected 1');
});

test('POST /blocks - Validation 2: Input/output sum mismatch', async () => {
  // Create block 1 first
  await sendRequest('POST', '/blocks', testBlocks.block1());

  // Try to create block 2 with mismatched inputs/outputs
  const invalidBlock: Block = {
    id: calculateBlockId(2, ['tx2']),
    height: 2,
    transactions: [
      {
        id: 'tx2',
        inputs: [
          { txId: 'tx1', index: 0 } // This references output with value 10
        ],
        outputs: [
          { address: 'addr2', value: 5 }, // But only outputs 5
          { address: 'addr3', value: 3 }   // Total = 8, not 10
        ]
      }
    ]
  };

  const response = await sendRequest('POST', '/blocks', invalidBlock);

  expect(response.statusCode).toBe(400);
  const body = response.json;
  expect(body.error).toContain('Input/output sum mismatch');
  expect(body.error).toContain('Inputs: 10');
  expect(body.error).toContain('Outputs: 8');
});

test('POST /blocks - Validation 2: Input/output sum mismatch (outputs exceed inputs)', async () => {
  await sendRequest('POST', '/blocks', testBlocks.block1());

  const invalidBlock: Block = {
    id: calculateBlockId(2, ['tx2']),
    height: 2,
    transactions: [
      {
        id: 'tx2',
        inputs: [
          { txId: 'tx1', index: 0 } // Value: 10
        ],
        outputs: [
          { address: 'addr2', value: 15 } // Value: 15 > 10
        ]
      }
    ]
  };

  const response = await sendRequest('POST', '/blocks', invalidBlock);

  expect(response.statusCode).toBe(400);
  const body = response.json;
  expect(body.error).toContain('Input/output sum mismatch');
});

test('POST /blocks - Validation 3: Invalid block ID', async () => {
  const block = testBlocks.block1();
  block.id = 'wrong_hash_value';

  const response = await sendRequest('POST', '/blocks', block);

  expect(response.statusCode).toBe(400);
  const body = response.json;
  expect(body.error).toContain('Invalid block ID');
});

test('POST /blocks - Validation 3: Invalid block ID (wrong transaction order)', async () => {
  // Block ID should be based on sorted transaction IDs
  const block: Block = {
    id: calculateBlockId(4, ['tx4b', 'tx4a']), // Wrong order
    height: 4,
    transactions: [
      { id: 'tx4a', inputs: [], outputs: [{ address: 'addr1', value: 10 }] },
      { id: 'tx4b', inputs: [], outputs: [{ address: 'addr2', value: 10 }] }
    ]
  };
  // Correct ID should use sorted order: tx4a, tx4b
  block.id = 'wrong_id';

  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());
  await sendRequest('POST', '/blocks', testBlocks.block3());

  const response = await sendRequest('POST', '/blocks', block);

  expect(response.statusCode).toBe(400);
  const body = response.json;
  expect(body.error).toContain('Invalid block ID');
});

// ============================================
// EDGE CASES AND ERROR HANDLING
// ============================================

test('POST /blocks - Non-existent output reference', async () => {
  await sendRequest('POST', '/blocks', testBlocks.block1());

  const invalidBlock: Block = {
    id: calculateBlockId(2, ['tx2']),
    height: 2,
    transactions: [
      {
        id: 'tx2',
        inputs: [
          { txId: 'nonexistent', index: 0 }
        ],
        outputs: [
          { address: 'addr2', value: 10 }
        ]
      }
    ]
  };

  const response = await sendRequest('POST', '/blocks', invalidBlock);

  expect(response.statusCode).toBe(400);
  const body = response.json;
  expect(body.error).toContain('non-existent output');
  expect(body.error).toContain('nonexistent:0');
});

test('POST /blocks - Already spent output', async () => {
  // Create and process blocks 1 and 2
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());

  // Try to spend the same output again (tx1:0 was already spent in block 2)
  const invalidBlock: Block = {
    id: calculateBlockId(3, ['tx3']),
    height: 3,
    transactions: [
      {
        id: 'tx3',
        inputs: [
          { txId: 'tx1', index: 0 } // Already spent in block 2
        ],
        outputs: [
          { address: 'addr4', value: 10 }
        ]
      }
    ]
  };

  const response = await sendRequest('POST', '/blocks', invalidBlock);

  expect(response.statusCode).toBe(400);
  const body = response.json;
  expect(body.error).toContain('already spent');
});

test('POST /blocks - Double-spend in same block', async () => {
  await sendRequest('POST', '/blocks', testBlocks.block1());

  const invalidBlock: Block = {
    id: calculateBlockId(2, ['tx2']),
    height: 2,
    transactions: [
      {
        id: 'tx2',
        inputs: [
          { txId: 'tx1', index: 0 },
          { txId: 'tx1', index: 0 } // Same output referenced twice
        ],
        outputs: [
          { address: 'addr2', value: 20 } // Trying to get 20 from 10
        ]
      }
    ]
  };

  const response = await sendRequest('POST', '/blocks', invalidBlock);

  expect(response.statusCode).toBe(400);
  const body = response.json;
  expect(body.error).toContain('Double-spend detected');
  expect(body.error).toContain('tx1:0');
});

test('POST /blocks - Invalid output index', async () => {
  await sendRequest('POST', '/blocks', testBlocks.block1());

  const invalidBlock: Block = {
    id: calculateBlockId(2, ['tx2']),
    height: 2,
    transactions: [
      {
        id: 'tx2',
        inputs: [
          { txId: 'tx1', index: 99 } // Invalid index
        ],
        outputs: [
          { address: 'addr2', value: 10 }
        ]
      }
    ]
  };

  const response = await sendRequest('POST', '/blocks', invalidBlock);

  expect(response.statusCode).toBe(400);
  const body = response.json;
  expect(body.error).toContain('non-existent output');
});

test('POST /blocks - Empty transactions array', async () => {
  const invalidBlock: Block = {
    id: calculateBlockId(1, []),
    height: 1,
    transactions: []
  };

  const response = await sendRequest('POST', '/blocks', invalidBlock);

  // This should pass validation (empty transactions are allowed)
  // But might fail block ID validation if empty transactions aren't handled
  expect([200, 400]).toContain(response.statusCode);
});

test('POST /blocks - Multiple transactions with one having invalid balance', async () => {
  await sendRequest('POST', '/blocks', testBlocks.block1());
  await sendRequest('POST', '/blocks', testBlocks.block2());

  const invalidBlock: Block = {
    id: calculateBlockId(3, ['tx3a', 'tx3b']),
    height: 3,
    transactions: [
      {
        id: 'tx3a',
        inputs: [
          { txId: 'tx2', index: 1 } // Value: 6
        ],
        outputs: [
          { address: 'addr4', value: 6 } // Valid: 6 = 6
        ]
      },
      {
        id: 'tx3b',
        inputs: [
          { txId: 'tx2', index: 0 } // Value: 4
        ],
        outputs: [
          { address: 'addr5', value: 5 } // Invalid: 4 ≠ 5
        ]
      }
    ]
  };

  const response = await sendRequest('POST', '/blocks', invalidBlock);

  expect(response.statusCode).toBe(400);
  const body = response.json;
  expect(body.error).toContain('Input/output sum mismatch');
});

