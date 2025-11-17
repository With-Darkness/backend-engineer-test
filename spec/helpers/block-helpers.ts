import { createHash } from 'crypto';
import type { Block } from '../../src/types/block.types';

export function calculateBlockId(height: number, transactionIds: string[]): string {
  const sortedIds = transactionIds.sort().join('');
  const input = `${height}${sortedIds}`;
  return createHash('sha256').update(input).digest('hex');
}

export const testBlocks = {
  // Block 1: First block with empty inputs (creates coins)
  block1: (): Block => ({
    id: calculateBlockId(1, ['tx1']),
    height: 1,
    transactions: [
      {
        id: 'tx1',
        inputs: [],
        outputs: [
          { address: 'addr1', value: 10 }
        ]
      }
    ]
  }),

  // Block 2: Spends from block1, splits into 2 outputs
  block2: (): Block => ({
    id: calculateBlockId(2, ['tx2']),
    height: 2,
    transactions: [
      {
        id: 'tx2',
        inputs: [
          { txId: 'tx1', index: 0 }
        ],
        outputs: [
          { address: 'addr2', value: 4 },
          { address: 'addr3', value: 6 }
        ]
      }
    ]
  }),

  // Block 3: Spends from block2, splits into 3 outputs
  block3: (): Block => ({
    id: calculateBlockId(3, ['tx3']),
    height: 3,
    transactions: [
      {
        id: 'tx3',
        inputs: [
          { txId: 'tx2', index: 1 }
        ],
        outputs: [
          { address: 'addr4', value: 2 },
          { address: 'addr5', value: 2 },
          { address: 'addr6', value: 2 }
        ]
      }
    ]
  }),

  // Block 4: Multiple transactions in one block
  block4: (): Block => ({
    id: calculateBlockId(4, ['tx4a', 'tx4b']),
    height: 4,
    transactions: [
      {
        id: 'tx4a',
        inputs: [
          { txId: 'tx2', index: 0 }
        ],
        outputs: [
          { address: 'addr7', value: 4 }
        ]
      },
      {
        id: 'tx4b',
        inputs: [
          { txId: 'tx3', index: 0 }
        ],
        outputs: [
          { address: 'addr8', value: 2 }
        ]
      }
    ]
  }),

  // Block with multiple inputs
  blockWithMultipleInputs: (height: number): Block => ({
    id: calculateBlockId(height, [`tx${height}`]),
    height,
    transactions: [
      {
        id: `tx${height}`,
        inputs: [
          { txId: 'tx3', index: 1 },
          { txId: 'tx3', index: 2 }
        ],
        outputs: [
          { address: 'addr9', value: 4 }
        ]
      }
    ]
  })
};

