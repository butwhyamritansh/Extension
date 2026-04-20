/**
 * messages.js — Message archival routes
 *
 * POST /api/messages — Archive a new message with metadata
 */

const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

// ─── Archive Message ────────────────────────────────────────────
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const { session_id, role, content, metadata } = req.body;

    // Validation
    if (!session_id) {
      return res.status(400).json({ error: "session_id is required" });
    }
    if (!role || !["user", "qwen", "chatgpt"].includes(role)) {
      return res.status(400).json({
        error: 'role must be one of: "user", "qwen", "chatgpt"',
      });
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ error: "content is required and must be non-empty" });
    }

    // Use a transaction for atomicity (message + metadata)
    await client.query("BEGIN");

    // Insert message
    const msgResult = await client.query(
      `INSERT INTO messages (session_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [session_id, role, content.trim()]
    );

    const message = msgResult.rows[0];

    // Insert metadata if provided
    let meta = null;
    if (metadata) {
      const metaResult = await client.query(
        `INSERT INTO metadata (message_id, source_platform, model_version, token_estimate)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          message.message_id,
          metadata.source_platform || null,
          metadata.model_version || null,
          metadata.token_estimate || null,
        ]
      );
      meta = metaResult.rows[0];
    }

    await client.query("COMMIT");

    console.log(
      `[Messages] Archived: ${role} message (${content.length} chars) → session ${session_id}`
    );

    res.status(201).json({
      message,
      metadata: meta,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Messages] Archive error:", err.message);
    res.status(500).json({ error: "Failed to archive message", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
