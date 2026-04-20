/**
 * sessions.js — Session management routes
 *
 * POST /api/sessions       — Create a new session
 * GET  /api/sessions       — List all sessions
 * GET  /api/sessions/:id/messages — Get all messages for a session
 */

const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

// ─── Create Session ─────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { title } = req.body;

    const result = await pool.query(
      `INSERT INTO sessions (title) VALUES ($1) RETURNING *`,
      [title || `Session ${new Date().toISOString()}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[Sessions] Create error:", err.message);
    res.status(500).json({ error: "Failed to create session", details: err.message });
  }
});

// ─── List Sessions ──────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*,
              COUNT(m.message_id)::int AS message_count
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.session_id
       GROUP BY s.session_id
       ORDER BY s.created_at DESC
       LIMIT 50`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[Sessions] List error:", err.message);
    res.status(500).json({ error: "Failed to list sessions", details: err.message });
  }
});

// ─── Get Session Messages ───────────────────────────────────────
router.get("/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT m.*, md.source_platform, md.model_version, md.token_estimate
       FROM messages m
       LEFT JOIN metadata md ON md.message_id = m.message_id
       WHERE m.session_id = $1
       ORDER BY m.created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[Sessions] Get messages error:", err.message);
    res.status(500).json({ error: "Failed to get messages", details: err.message });
  }
});

module.exports = router;
