const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

// Create Postgres connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "saas-cpq-api",
    timestamp: new Date().toISOString(),
  });
});

// DB health endpoint
app.get("/db-health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as now");
    res.json({ ok: true, now: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// List quotes for a customer

app.get("/customers/:id/quotes", async (req, res) => {
  const customerId = Number(req.params.id);

  if (!Number.isInteger(customerId)) {
    return res.status(400).json({ ok: false, error: "Invalid customer id" });
  }

  try {
    const result = await pool.query(
      `SELECT
         id,
         customer_id,
         job_name,
         currency,
         tax_rate,
         discount,
         total,
         created_at
       FROM quotes
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    );

    res.json({ ok: true, customer_id: customerId, quotes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


// Create a customer
app.post("/customers", async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== "string") {
    return res
      .status(400)
      .json({ ok: false, error: "name is required (string)" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO customers (name) VALUES ($1) RETURNING id, name, created_at",
      [name.trim()]
    );
    res.status(201).json({ ok: true, customer: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Create a quote with line items (CPQ v0: cost/sell)
app.post("/quotes", async (req, res) => {
  const { customer_id, job_name, currency, tax_rate, discount, line_items } = req.body || {};

  const custId = Number(customer_id);
  if (!Number.isInteger(custId)) {
    return res.status(400).json({ ok: false, error: "customer_id must be an integer" });
  }
  if (!job_name || typeof job_name !== "string") {
    return res.status(400).json({ ok: false, error: "job_name is required (string)" });
  }
  if (!Array.isArray(line_items) || line_items.length === 0) {
    return res.status(400).json({ ok: false, error: "line_items must be a non-empty array" });
  }

  const curr = (currency && String(currency).trim().toUpperCase()) || "USD";
  const tr = Number(tax_rate ?? 0);
  const disc = Number(discount ?? 0);

  if (!Number.isFinite(tr) || tr < 0) {
    return res.status(400).json({ ok: false, error: "tax_rate must be a number >= 0" });
  }
  if (!Number.isFinite(disc) || disc < 0) {
    return res.status(400).json({ ok: false, error: "discount must be a number >= 0" });
  }

  let normalized;
  try {
    normalized = line_items.map((li, idx) => {
      const type = String(li.type || "").trim().toLowerCase();
      const uom = String(li.uom || "").trim().toUpperCase();
      const description = String(li.description || "").trim();
      const qty = Number(li.qty ?? 1);
      const cost = Number(li.cost ?? 0);
      const sell = Number(li.sell ?? 0);

      if (!["labor", "equipment", "material"].includes(type)) {
        throw new Error(`line_items[${idx}].type must be labor|equipment|material`);
      }
      if (!uom) throw new Error(`line_items[${idx}].uom is required`);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error(`line_items[${idx}].qty must be > 0`);
      if (!Number.isFinite(cost) || cost < 0) throw new Error(`line_items[${idx}].cost must be >= 0`);
      if (!Number.isFinite(sell) || sell < 0) throw new Error(`line_items[${idx}].sell must be >= 0`);

      return { type, uom, description, qty, cost, sell };
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }

  // totals (simple v0)
  const subtotal = normalized.reduce((sum, li) => sum + li.sell * li.qty, 0);
  const taxed = subtotal * (1 + tr);
  const total = Math.round((taxed - disc) * 100) / 100;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cust = await client.query("SELECT id FROM customers WHERE id = $1", [custId]);
    if (cust.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "customer_id not found" });
    }

    const quoteResult = await client.query(
      `INSERT INTO quotes (customer_id, job_name, currency, tax_rate, discount, total)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, customer_id, job_name, currency, tax_rate, discount, total, created_at`,
      [custId, job_name.trim(), curr, tr, disc, total]
    );
    const quote = quoteResult.rows[0];

    const insertedItems = [];
    for (const li of normalized) {
      const itemRes = await client.query(
        `INSERT INTO quote_line_items (quote_id, type, description, uom, qty, cost, sell)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, quote_id, type, description, uom, qty, cost, sell`,
        [quote.id, li.type, li.description, li.uom, li.qty, li.cost, li.sell]
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query("COMMIT");
    res.status(201).json({ ok: true, quote, line_items: insertedItems });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// Get a quote with its line items
app.get("/quotes/:id", async (req, res) => {
  const quoteId = Number(req.params.id);
  if (!Number.isInteger(quoteId)) {
    return res.status(400).json({ ok: false, error: "Invalid quote id" });
  }

  try {
    const quoteRes = await pool.query(
      "SELECT id, customer_id, job_name, currency, tax_rate, discount, total, created_at FROM quotes WHERE id = $1",
      [quoteId]
    );

    if (quoteRes.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "quote not found" });
    }

    const itemsRes = await pool.query(
      "SELECT id, quote_id, type, description, uom, qty, cost, sell FROM quote_line_items WHERE quote_id = $1 ORDER BY id",
      [quoteId]
    );

    res.json({ ok: true, quote: quoteRes.rows[0], line_items: itemsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
