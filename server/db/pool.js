/**
 * pool.js — PostgreSQL connection pool singleton
 */

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || "llm_bridge",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  max: 10,              // Maximum connections in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log pool errors (don't crash the server)
pool.on("error", (err) => {
  console.error("[DB Pool] Unexpected error on idle client:", err.message);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[DB Pool] Draining pool...");
  await pool.end();
  console.log("[DB Pool] Pool drained.");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[DB Pool] Draining pool...");
  await pool.end();
  console.log("[DB Pool] Pool drained.");
  process.exit(0);
});

module.exports = pool;
