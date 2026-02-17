const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");   
const app = express();

// Create Postgres connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok",
    service: "saas-cpq-api",
    timestamp: new Date().toISOString()
  });
});

// New DB health endpoint
app.get("/db-health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as now");
    res.json({ ok: true, now: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
