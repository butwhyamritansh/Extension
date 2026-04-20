/**
 * auth.js — Bearer token authentication middleware
 *
 * Validates the Authorization header against the AUTH_TOKEN env var.
 * Rejects unauthorized requests with 401.
 */

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing Authorization header",
    });
  }

  // Expect format: "Bearer <token>"
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid Authorization format. Expected: Bearer <token>",
    });
  }

  const token = parts[1];
  const expectedToken = process.env.AUTH_TOKEN;

  if (!expectedToken) {
    console.error("[Auth] AUTH_TOKEN environment variable is not set!");
    return res.status(500).json({
      error: "Server Configuration Error",
      message: "Server auth token not configured",
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(token, expectedToken)) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid authentication token",
    });
  }

  next();
}

/**
 * Simple constant-time string comparison.
 * Prevents timing-based side-channel attacks on token validation.
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

module.exports = authMiddleware;
