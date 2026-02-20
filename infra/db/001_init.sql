-- 001_init.sql
-- Basic CPQ schema (starter)
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- Customers

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Quotes

CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  job_name TEXT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- Quote Line Items

CREATE TABLE IF NOT EXISTS quote_line_items (
  id SERIAL PRIMARY KEY,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('labor','equipment','material')),
  description TEXT,
  uom TEXT NOT NULL,
  qty NUMERIC(12,4) NOT NULL DEFAULT 1,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  sell NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

--Component Table for Items on quotes/invoicing

CREATE TABLE IF NOT EXISTS components (
  id SERIAL PRIMARY KEY,
  component_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('labor','equipment','material')),
  default_uom TEXT NOT NULL,
  default_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  default_sell NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ===========================
-- Seed Data
-- ===========================

-- Insert test customer
INSERT INTO customers (id, name)
VALUES (1, 'Test Environmental Services')
ON CONFLICT (id) DO NOTHING;

-- Insert test quote
INSERT INTO quotes (
  id,
  customer_id,
  job_name,
  currency,
  tax_rate,
  discount,
  total
)
VALUES (
  1,
  1,
  'Techs + Vac Truck',
  'USD',
  0,
  0,
  3850
)
ON CONFLICT (id) DO NOTHING;

-- Insert test line items
INSERT INTO quote_line_items (
  quote_id,
  type,
  description,
  uom,
  qty,
  cost,
  sell
)
VALUES
  (1, 'labor', '2 Techs - 8 hours', 'HR', 16, 65, 125),
  (1, 'equipment', 'Vac truck day rate', 'DAY', 1, 900, 1850);