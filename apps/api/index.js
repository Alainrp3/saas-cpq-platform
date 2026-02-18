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

// Create a quote with line items
app.post("/quotes", async (req, res) => {
  const { customer_id, status, line_items } = req.body || {};

  if (!customer_id) {
    return res
      .status(400)
      .json({ ok: false, error: "customer_id is required" });
  }
  if (!Array.isArray(line_items) || line_items.length === 0) {
    return res
      .status(400)
      .json({ ok: false, error: "line_items must be a non-empty array" });
  }

  // Basic validation + totals
  let normalized;
  try {
    normalized = line_items.map((li, idx) => {
      const description = String(li.description || "").trim();
      const qty = Number(li.qty ?? 1);
      const unit_price = Number(li.unit_price ?? 0);

      if (!description)
        throw new Error(`line_items[${idx}].description is required`);
      if (!Number.isFinite(qty) || qty <= 0)
        throw new Error(`line_items[${idx}].qty must be > 0`);
      if (!Number.isFinite(unit_price) || unit_price < 0)
        throw new Error(`line_items[${idx}].unit_price must be >= 0`);

      const line_total = Math.round(qty * unit_price * 100) / 100;
      return { description, qty, unit_price, line_total };
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }

  const subtotal = Math.round(
    normalized.reduce((sum, li) => sum + li.line_total, 0) * 100
  ) / 100;

  const quoteStatus = (status && String(status).trim()) || "draft";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure customer exists
    const cust = await client.query("SELECT id FROM customers WHERE id = $1", [
      customer_id,
    ]);
    if (cust.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "customer_id not found" });
    }

    // Create quote
    const quoteResult = await client.query(
      "INSERT INTO quotes (customer_id, status, subtotal) VALUES ($1, $2, $3) RETURNING id, customer_id, status, subtotal, created_at",
      [customer_id, quoteStatus, subtotal]
    );
    const quote = quoteResult.rows[0];

    // Insert line items
    const insertedItems = [];
    for (const li of normalized) {
      const itemRes = await client.query(
        `INSERT INTO quote_line_items (quote_id, description, qty, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, quote_id, description, qty, unit_price, line_total`,
        [quote.id, li.description, li.qty, li.unit_price, li.line_total]
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
  const { id } = req.params;

  try {
    const quoteRes = await pool.query(
      "SELECT id, customer_id, status, subtotal, created_at FROM quotes WHERE id = $1",
      [id]
    );

    if (quoteRes.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "quote not found" });
    }

    // ✅ ORDER BY id (quote_line_items doesn't have created_at)
    const itemsRes = await pool.query(
      "SELECT id, quote_id, description, qty, unit_price, line_total FROM quote_line_items WHERE quote_id = $1 ORDER BY id",
      [id]
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
