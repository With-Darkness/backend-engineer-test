-- =========================================
-- 1. Table: addresses
-- Stores the balance of each address
-- =========================================
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    address VARCHAR(100) NOT NULL UNIQUE,
    balance BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================
-- 2. Table: blocks
-- Stores each block
-- =========================================
CREATE TABLE blocks (
    id VARCHAR(64) PRIMARY KEY, -- SHA256 hash of block
    height INT NOT NULL UNIQUE, -- Block height
    created_at TIMESTAMP DEFAULT NOW()
);

-- =========================================
-- 3. Table: transactions
-- Stores transactions in each block
-- =========================================
CREATE TABLE transactions (
    id VARCHAR(64) PRIMARY KEY, -- Transaction ID
    block_id VARCHAR(64) REFERENCES blocks (id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =========================================
-- 4. Table: transaction_inputs
-- Tracks UTXOs spent by each transaction
-- =========================================
CREATE TABLE transaction_inputs (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(64) REFERENCES transactions (id) ON DELETE CASCADE,
    from_address VARCHAR(100) REFERENCES addresses (address),
    amount BIGINT NOT NULL
);

-- =========================================
-- 5. Table: transaction_outputs
-- Tracks UTXOs created by each transaction
-- =========================================
CREATE TABLE transaction_outputs (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(64) REFERENCES transactions (id) ON DELETE CASCADE,
    to_address VARCHAR(100) REFERENCES addresses (address),
    amount BIGINT NOT NULL
);

-- =========================================
-- Indexes for faster queries
-- =========================================
CREATE INDEX idx_address_balance ON addresses (address);

CREATE INDEX idx_block_height ON blocks (height);

CREATE INDEX idx_tx_block ON transactions (block_id);

CREATE INDEX idx_inputs_tx ON transaction_inputs (transaction_id);

CREATE INDEX idx_outputs_tx ON transaction_outputs (transaction_id);