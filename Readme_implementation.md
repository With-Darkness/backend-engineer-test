# Implemented Features

## API Endpoints

### 1. POST /blocks

Submit a new block to the blockchain indexer.

**Validations:**

- ✅ Block height must be exactly one unit higher than current height (first block = height 1)
- ✅ Sum of input values must equal sum of output values (for transactions with inputs)
- ✅ Block ID must be SHA256 hash of `height + sorted_transaction_ids`
- ✅ Double-spend detection (same output referenced multiple times)
- ✅ Non-existent output reference detection
- ✅ Already spent output detection

**Features:**

- ✅ Processes blocks atomically (database transactions)
- ✅ Updates address balances automatically
- ✅ Tracks UTXOs (unspent transaction outputs)
- ✅ Marks outputs as spent when referenced by inputs

### 2. GET /balance/:address

Get the current balance of an address.

**Features:**

- ✅ Calculates balance from UTXOs (unspent outputs)
- ✅ Returns 0 for addresses with no balance
- ✅ Real-time balance calculation from database

### 3. POST /rollback?height=number

Rollback the blockchain indexer to a specific height.

**Features:**

- ✅ Deletes all blocks above target height
- ✅ Cascades deletion of transactions, inputs, and outputs
- ✅ Resets spent flags for outputs no longer referenced
- ✅ Recalculates all address balances from remaining UTXOs
- ✅ Atomic operation (all or nothing)
- ✅ Validates target height (non-negative)

## Database Schema

- ✅ `blocks` - Stores block information (id, height)
- ✅ `transactions` - Stores transaction information
- ✅ `outputs` - Stores UTXOs (address, value, spent flag)
- ✅ `inputs` - Tracks which outputs are spent
- ✅ `address_balances` - Cached balance table (for performance)

## Testing

- ✅ Comprehensive test suite (41 tests)
- ✅ Block validation tests (17 tests)
- ✅ Balance calculation tests (10 tests)
- ✅ Rollback operation tests (14 tests)
- ✅ Success and failure scenarios covered
- ✅ Integration tests using real HTTP server

## Code Quality

- ✅ Error handling middleware
- ✅ Unified error classes
- ✅ Response helpers
- ✅ Validation utilities
- ✅ Query parameter parsing utilities
- ✅ Absolute imports (src/ prefix)
- ✅ Type-safe with TypeScript
- ✅ Clean architecture (layered structure)
