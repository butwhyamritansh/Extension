# TODO — Qwen↔ChatGPT Bridge Extension

> Phase-by-phase task checklist. Update status markers as work progresses.  
> `[ ]` = not started · `[/]` = in progress · `[x]` = done

---

## Phase 1 — Scaffolding & Manifest (Day 1–2)

- [ ] Create project directory structure (`popup/`, `background/`, `content_scripts/`, `utils/`, `icons/`, `server/`)
- [ ] Write `manifest.json`
  - [ ] Declare Manifest V3 version
  - [ ] Register `background/service-worker.js` as the service worker
  - [ ] Define `content_scripts` entries for `*://*.qwen.ai/*` and `*://*.chatgpt.com/*`
  - [ ] Set `permissions`: `activeTab`, `scripting`, `storage`
  - [ ] Set `host_permissions`: `*://*.chatgpt.com/*`, `*://*.qwen.ai/*`, `http://localhost:3000/*`
  - [ ] Configure `action` with popup and icons
- [ ] Build popup shell
  - [ ] `popup/popup.html` — layout with status panel, trigger button area
  - [ ] `popup/popup.css` — dark theme styling
  - [ ] `popup/popup.js` — basic message listener, status rendering
- [ ] Create `background/service-worker.js` skeleton
  - [ ] `chrome.runtime.onMessage` listener
  - [ ] Action dispatch map (stub handlers for `SEND_TO_CHATGPT`, `ARCHIVE_RESPONSE`)
- [ ] Create `utils/constants.js`
  - [ ] Action type constants
  - [ ] Default selector strings for Qwen and ChatGPT
  - [ ] Configuration values (timeouts, debounce intervals)
- [ ] Create `utils/messaging.js`
  - [ ] `sendToBackground()` wrapper
  - [ ] `sendToTab()` wrapper
- [ ] Generate/source extension icons (16px, 48px, 128px)
- [ ] Write initial `README.md` with load-unpacked dev instructions
- [ ] Create `.gitignore`
- [ ] **✅ Milestone:** Extension loads in `chrome://extensions` without errors; popup opens

---

## Phase 2 — Qwen Extraction Pipeline (Day 3–5)

- [ ] Implement `content_scripts/qwen.js`
  - [ ] DOM query for latest assistant response container
  - [ ] `innerText` extraction from text content node
  - [ ] Fallback selector chain (class-based → data-attr → last-child heuristic)
- [ ] Implement extraction triggers
  - [ ] Keyboard shortcut listener (`Ctrl+Shift+Q`)
  - [ ] Inject floating "Extract & Send" button into Qwen UI
- [ ] Implement streaming guard (optional)
  - [ ] MutationObserver watching for active generation indicators
  - [ ] Block extraction + show warning when generation is still in progress
- [ ] Wire message dispatch
  - [ ] Send `{ action: "SEND_TO_CHATGPT", text, timestamp }` to service worker
- [ ] Build `utils/selectors.js`
  - [ ] `queryResilient(selectorChain)` — tries each selector in order
  - [ ] Console warn on fallback usage
- [ ] **✅ Milestone:** Extract text from completed Qwen response → logged in service worker console

---

## Phase 3 — ChatGPT Injection & Response Observation (Day 6–10)

- [ ] Implement `content_scripts/chatgpt.js` — injection module
  - [ ] Locate input field (`#prompt-textarea` / `[data-testid="prompt-textarea"]`)
  - [ ] `element.focus()`
  - [ ] `document.execCommand('selectAll')` to clear
  - [ ] `document.execCommand('delete')`
  - [ ] `document.execCommand('insertText', false, text)` to inject
  - [ ] Locate and `.click()` send button (`button[data-testid="send-button"]`)
- [ ] Implement MutationObserver — Primary heuristic (copy button)
  - [ ] Count existing copy buttons before send
  - [ ] Attach observer to chat container (`childList`, `subtree`)
  - [ ] In callback: check if copy button count incremented
  - [ ] On detection: extract response text, `disconnect()` observer
- [ ] Implement MutationObserver — Secondary heuristic (stop button)
  - [ ] Watch for appearance then removal of `[data-testid='stop-button']`
  - [ ] On removal: extract response text
- [ ] Implement MutationObserver — Tertiary heuristic (debounce)
  - [ ] Attach CharacterData observer to latest assistant message
  - [ ] Reset `clearTimeout` on every mutation
  - [ ] After 1500ms silence: extract response text
- [ ] Implement response extraction
  - [ ] Query latest `[data-message-author-role='assistant']` node
  - [ ] Read `innerText`
- [ ] Wire archive dispatch
  - [ ] Send `{ action: "ARCHIVE_RESPONSE", text, metadata: { source: "chatgpt", timestamp } }` to service worker
- [ ] **✅ Milestone:** Full injection → submission → detection → extraction cycle works without manual intervention

---

## Phase 4 — Node.js / PostgreSQL Backend (Day 7–10)

- [ ] Scaffold `server/` project
  - [ ] `npm init -y`
  - [ ] Install dependencies: `express`, `pg`, `cors`, `dotenv`, `helmet`, `uuid`
- [ ] Write `server/db/schema.sql`
  - [ ] `sessions` table (UUID PK, title, created_at)
  - [ ] `messages` table (UUID PK, session FK, role CHECK, content TEXT, created_at)
  - [ ] `metadata` table (UUID PK, message FK UNIQUE, source_platform, model_version, token_estimate)
  - [ ] Indexes on session_id, created_at, message_id
- [ ] Run schema against local PostgreSQL
  - [ ] Create database `llm_bridge`
  - [ ] Execute `schema.sql`
- [ ] Write `server/db/pool.js`
  - [ ] `pg.Pool` with config from `process.env`
  - [ ] Graceful shutdown on `SIGTERM`
- [ ] Write `server/middleware/auth.js`
  - [ ] Extract `Authorization: Bearer <token>` from request
  - [ ] Compare against `process.env.AUTH_TOKEN`
  - [ ] Return `401` on mismatch
- [ ] Write `server/routes/sessions.js`
  - [ ] `POST /api/sessions` — create new session, return UUID
  - [ ] `GET /api/sessions` — list all sessions ordered by `created_at DESC`
  - [ ] `GET /api/sessions/:id/messages` — fetch all messages for a session
- [ ] Write `server/routes/messages.js`
  - [ ] `POST /api/messages` — validate body, insert into `messages` + `metadata`, return `201` + `RETURNING *`
  - [ ] Parameterized queries only (SQL injection prevention)
- [ ] Write `server/index.js`
  - [ ] Load `.env` via `dotenv`
  - [ ] Configure `cors` for `chrome-extension://*`
  - [ ] Mount `helmet`, JSON body parser
  - [ ] Mount auth middleware
  - [ ] Mount route files
  - [ ] Start listening on `process.env.PORT || 3000`
- [ ] Create `server/.env.example`
- [ ] **✅ Milestone:** `curl` POST to `/api/messages` returns `201`; row visible in `psql`

---

## Phase 5 — Integration, Polish & Hardening (Day 11–14)

- [ ] Wire service worker → backend HTTP proxy
  - [ ] `fetch()` POST to `http://localhost:3000/api/messages`
  - [ ] Include `Authorization: Bearer <token>` header
  - [ ] Parse and forward response back to content script
- [ ] Implement error handling in service worker
  - [ ] Exponential backoff on failed POSTs (3 retries: 1s, 4s, 16s)
  - [ ] Queue failed messages in `chrome.storage.session`
  - [ ] Retry queued messages on next successful connection
- [ ] Enhance popup UI
  - [ ] Connection health indicator (green dot = server reachable, red = down)
  - [ ] Last synced timestamp display
  - [ ] Session list with message counts
  - [ ] "New Session" button
  - [ ] Error notification toasts
- [ ] Implement session management
  - [ ] Auto-create session on extension install / first launch
  - [ ] Store active `session_id` in `chrome.storage.local`
  - [ ] Manual session creation from popup
- [ ] Store auth token securely
  - [ ] Save token via `chrome.storage.local` from popup settings
  - [ ] Service worker reads token on demand
- [ ] Extension badge
  - [ ] Update badge text with sync count
  - [ ] Color badge red on error state
- [ ] Comprehensive `README.md`
  - [ ] Prerequisites (Chrome, Node.js, PostgreSQL)
  - [ ] Installation steps (clone, load unpacked, create DB, npm install, configure .env)
  - [ ] Architecture overview with diagram
  - [ ] Usage guide with screenshots
  - [ ] Troubleshooting / FAQ
- [ ] Testing & hardening
  - [ ] Test with multiple Qwen/ChatGPT tabs open simultaneously
  - [ ] Test network failure recovery (kill server mid-sync)
  - [ ] Test incomplete/streaming response extraction guard
  - [ ] Test rapid successive extractions (< 2s apart)
  - [ ] Test long responses (> 10,000 characters)
  - [ ] Test with empty/error ChatGPT responses
- [ ] **✅ Milestone:** 10 consecutive end-to-end cycles complete without failure

---

## Stretch Goals

- [ ] Add support for additional LLM platforms (Claude, Gemini)
- [ ] Build a dashboard page (`dashboard.html`) to browse archived sessions
- [ ] Implement export functionality (JSON, CSV, Markdown)
- [ ] Add token counting estimation in metadata
- [ ] Implement rate limiting on the Express server
- [ ] Package for Chrome Web Store distribution
