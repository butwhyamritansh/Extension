/**
 * constants.js — Shared constants for Qwen↔ChatGPT Bridge Extension
 * Loaded by both content scripts and referenced by the service worker.
 */

// ─── Action Types ───────────────────────────────────────────────
const ACTIONS = {
  /** Qwen content script → service worker → ChatGPT content script */
  SEND_TO_CHATGPT: "SEND_TO_CHATGPT",

  /** ChatGPT content script → service worker → backend */
  ARCHIVE_RESPONSE: "ARCHIVE_RESPONSE",

  /** Popup → service worker: request current status */
  GET_STATUS: "GET_STATUS",

  /** Service worker → popup: status update */
  STATUS_UPDATE: "STATUS_UPDATE",

  /** Popup → service worker: trigger extraction manually */
  TRIGGER_EXTRACT: "TRIGGER_EXTRACT",

  /** Service worker → content script: inject text */
  INJECT_TEXT: "INJECT_TEXT",

  /** Popup → service worker: create a new session */
  NEW_SESSION: "NEW_SESSION",

  /** Any → service worker: report an error */
  REPORT_ERROR: "REPORT_ERROR",
};

// ─── Qwen DOM Selectors (ordered by reliability) ────────────────
const QWEN_SELECTORS = {
  /** Primary: assistant response containers */
  assistantMessage: [
    'div[class*="assistant-response"]',
    'div[class*="assistant"]',
    '[data-role="assistant"]',
  ],
  /** Text payload within an assistant message */
  textContent: [
    ".markdown-body",
    ".text-content",
    '[class*="markdown"]',
  ],
  /** User input area (to avoid extracting user text) */
  userInput: [
    '[data-lexical-editor="true"]',
    'div[class*="user-input"]',
  ],
  /** Chat container */
  chatContainer: [
    'div[class*="message-container"]',
    'div[class*="chat-container"]',
    "main",
  ],
};

// ─── ChatGPT DOM Selectors (ordered by reliability) ─────────────
const CHATGPT_SELECTORS = {
  /** Primary input field */
  inputField: [
    '[data-testid="prompt-textarea"]',
    "div#prompt-textarea.ProseMirror",
    "div#prompt-textarea",
    '[contenteditable="true"]',
  ],
  /** Send / submit button */
  sendButton: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label*="Send"]',
  ],
  /** Copy button (primary completion heuristic) */
  copyButton: [
    'button[data-testid*="copy"]',
    'button[aria-label*="Copy"]',
  ],
  /** Stop generating button (secondary heuristic) */
  stopButton: [
    '[data-testid="stop-button"]',
    'button[aria-label*="Stop"]',
  ],
  /** Assistant message wrapper */
  assistantMessage: [
    '[data-message-author-role="assistant"]',
    'div[class*="assistant"]',
  ],
  /** Text payload inside assistant message */
  textContent: [
    ".whitespace-pre-wrap",
    ".markdown",
    '[class*="markdown"]',
  ],
  /** Main chat thread container */
  chatContainer: [
    'main div[class*="react-scroll"]',
    "main",
    '[role="presentation"]',
  ],
};

// ─── Configuration ──────────────────────────────────────────────
const CONFIG = {
  /** Local backend server URL */
  SERVER_URL: "http://localhost:3000",

  /** API endpoints */
  API: {
    MESSAGES: "/api/messages",
    SESSIONS: "/api/sessions",
  },

  /** Debounce timeout for text-stability heuristic (ms) */
  DEBOUNCE_TIMEOUT_MS: 1500,

  /** Max retries for failed backend POST requests */
  MAX_RETRIES: 3,

  /** Base delay for exponential backoff (ms) */
  RETRY_BASE_DELAY_MS: 1000,

  /** Keyboard shortcut for Qwen extraction */
  EXTRACT_SHORTCUT: { ctrlKey: true, shiftKey: true, key: "Q" },

  /** Extension version */
  VERSION: "1.0.0",
};
