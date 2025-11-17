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

## Running the Project

### Prerequisites

- Docker and Docker Compose installed
- Bun runtime (or Node.js)
- PostgreSQL database (via Docker or local)

### Setup Environment

Create a `.env` file in the project root:

```env
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=mydatabase
DB_PORT=5432
API_PORT=3000
DATABASE_URL=postgres://myuser:mypassword@localhost:5432/mydatabase
```

### Start with Docker

```bash
# Start database and API services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Start Manually

```bash
# 1. Start database (if using Docker for DB only)
docker-compose up -d db

# 2. Start the API
bun src/index.ts
# or
npm start
```

The API will be available at `http://localhost:3000`

## Running Tests

### Run All Tests

```bash
bun test
```

This will run all test files:

- `spec/blocks.spec.ts` (17 tests)
- `spec/balance.spec.ts` (10 tests)
- `spec/rollback.spec.ts` (14 tests)

**Total: 41 tests**

### Run Individual Test Files

```bash
# Run only block tests
bun test spec/blocks.spec.ts

# Run only balance tests
bun test spec/balance.spec.ts

# Run only rollback tests
bun test spec/rollback.spec.ts
```

### Run Specific Test

```bash
# Run a specific test by name
bun test --test-name-pattern "POST /blocks - Block 1"
```

### Test Requirements

- Database must be running (via Docker or local PostgreSQL)
- `DATABASE_URL` must be set in `.env` or environment
- Port 3000 must be available (tests start a server on this port)

### Test Output

Tests will show:

- ✅ Passing tests
- ❌ Failing tests with error details
- Test execution time
- Summary of passed/failed tests
