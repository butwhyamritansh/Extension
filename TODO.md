# TODO — Qwen↔ChatGPT Bridge Extension

> Phase-by-phase task checklist. Update status markers as work progresses.  
> `[ ]` = not started · `[/]` = in progress · `[x]` = done

---

## Phase 1 — Scaffolding & Manifest (Day 1–2)

- [x] Create project directory structure (`popup/`, `background/`, `content_scripts/`, `utils/`, `icons/`, `server/`)
- [x] Write `manifest.json`
  - [x] Declare Manifest V3 version
  - [x] Register `background/service-worker.js` as the service worker
  - [x] Define `content_scripts` entries for `*://*.qwen.ai/*` and `*://*.chatgpt.com/*`
  - [x] Set `permissions`: `activeTab`, `scripting`, `storage`
  - [x] Set `host_permissions`: `*://*.chatgpt.com/*`, `*://*.qwen.ai/*`, `http://localhost:3000/*`
  - [x] Configure `action` with popup and icons
- [x] Build popup shell
  - [x] `popup/popup.html` — layout with status panel, trigger button area
  - [x] `popup/popup.css` — dark theme styling
  - [x] `popup/popup.js` — basic message listener, status rendering
- [x] Create `background/service-worker.js` skeleton
  - [x] `chrome.runtime.onMessage` listener
  - [x] Action dispatch map (stub handlers for `SEND_TO_CHATGPT`, `ARCHIVE_RESPONSE`)
- [x] Create `utils/constants.js`
  - [x] Action type constants
  - [x] Default selector strings for Qwen and ChatGPT
  - [x] Configuration values (timeouts, debounce intervals)
- ~~[ ] Create `utils/messaging.js`~~ *(removed April 2026 — dead code; content scripts and SW inline `chrome.runtime.sendMessage` directly)*
- [x] Generate/source extension icons (16px, 48px, 128px) *(split packaged JPEG into proper PNG set, April 2026)*
- [x] Write initial `README.md` with load-unpacked dev instructions
- [x] Create `.gitignore`
- [/] **✅ Milestone:** Extension loads in `chrome://extensions` without errors; popup opens *(all prerequisites met — pending actual Chrome load verification)*

---

## Phase 2 — Qwen Extraction Pipeline (Day 3–5)

- [x] Implement `content_scripts/qwen.js`
  - [x] DOM query for latest assistant response container
  - [x] `innerText` extraction from text content node
  - [x] Fallback selector chain (class-based → data-attr → last-child heuristic)
- [x] Implement extraction triggers
  - [x] Keyboard shortcut listener (`Ctrl+Shift+Q`)
  - [x] Inject floating "Extract & Send" button into Qwen UI
- [x] Implement streaming guard (optional)
  - [x] MutationObserver watching for active generation indicators
  - [x] Block extraction + show warning when generation is still in progress
- [x] Wire message dispatch
  - [x] Send `{ action: "SEND_TO_CHATGPT", text, timestamp }` to service worker
- [x] Build `utils/selectors.js`
  - [x] `queryResilient(selectorChain)` — tries each selector in order
  - [x] Console warn on fallback usage
- [/] **✅ Milestone:** Extract text from completed Qwen response → logged in service worker console *(pending live Chrome verification)*

---

## Phase 3 — ChatGPT Injection & Response Observation (Day 6–10)

- [x] Implement `content_scripts/chatgpt.js` — injection module
  - [x] Locate input field (`#prompt-textarea` / `[data-testid="prompt-textarea"]`)
  - [x] `element.focus()`
  - [x] `document.execCommand('selectAll')` to clear
  - [x] `document.execCommand('delete')`
  - [x] `document.execCommand('insertText', false, text)` to inject
  - [x] Locate and `.click()` send button (`button[data-testid="send-button"]`)
- [x] Implement MutationObserver — Primary heuristic (copy button)
  - [x] Count existing copy buttons before send
  - [x] Attach observer to chat container (`childList`, `subtree`)
  - [x] In callback: check if copy button count incremented
  - [x] On detection: extract response text, `disconnect()` observer
  - [x] Scope selector to `copy-turn-action-button` testid so code-block copy buttons don't trip early (April 2026 audit fix)
- [x] Implement MutationObserver — Secondary heuristic (stop button)
  - [x] Watch for appearance then removal of `[data-testid='stop-button']`
  - [x] On removal: extract response text
- [x] Implement MutationObserver — Tertiary heuristic (debounce)
  - [x] Attach CharacterData observer to latest assistant message
  - [x] Reset `clearTimeout` on every mutation
  - [x] After 1500ms silence: extract response text
- [x] Implement response extraction
  - [x] Query latest `[data-message-author-role='assistant']` node
  - [x] Read `innerText`
- [x] Wire archive dispatch
  - [x] Send `{ action: "ARCHIVE_RESPONSE", text, metadata: { source: "chatgpt", timestamp } }` to service worker
- [/] **✅ Milestone:** Full injection → submission → detection → extraction cycle works without manual intervention *(pending live Chrome verification)*

---

## Phase 4 — Node.js / PostgreSQL Backend (Day 7–10)

- [x] Scaffold `server/` project
  - [x] `npm init -y`
  - [x] Install dependencies: `express`, `pg`, `cors`, `dotenv`, `helmet`, `uuid` *(87 packages, 0 vulns)*
- [x] Write `server/db/schema.sql`
  - [x] `sessions` table (UUID PK, title, created_at)
  - [x] `messages` table (UUID PK, session FK, role CHECK, content TEXT, created_at)
  - [x] `metadata` table (UUID PK, message FK UNIQUE, source_platform, model_version, token_estimate)
  - [x] Indexes on session_id, created_at, message_id
- [x] Run schema against local PostgreSQL
  - [x] Create database `llm_bridge`
  - [x] Execute `schema.sql`
- [x] Write `server/db/pool.js`
  - [x] `pg.Pool` with config from `process.env`
  - [x] Graceful shutdown on `SIGTERM`
- [x] Write `server/middleware/auth.js`
  - [x] Extract `Authorization: Bearer <token>` from request
  - [x] Compare against `process.env.AUTH_TOKEN` (timing-safe compare)
  - [x] Return `401` on mismatch
- [x] Write `server/routes/sessions.js`
  - [x] `POST /api/sessions` — create new session, return UUID
  - [x] `GET /api/sessions` — list all sessions ordered by `created_at DESC`
  - [x] `GET /api/sessions/:id/messages` — fetch all messages for a session
- [x] Write `server/routes/messages.js`
  - [x] `POST /api/messages` — validate body, insert into `messages` + `metadata`, return `201` + `RETURNING *`
  - [x] Parameterized queries only (SQL injection prevention)
- [x] Write `server/index.js`
  - [x] Load `.env` via `dotenv`
  - [x] Configure `cors` for `chrome-extension://*`
  - [x] Mount `helmet`, JSON body parser
  - [x] Mount auth middleware
  - [x] Mount route files
  - [x] Start listening on `process.env.PORT || 3000`
- [x] Create `server/.env.example`
- [x] **✅ Milestone:** `curl` POST to `/api/messages` returns `201`; row visible in `psql` *(verified via live smoke test, April 2026)*

---

## Phase 5 — Integration, Polish & Hardening (Day 11–14)

- [x] Wire service worker → backend HTTP proxy
  - [x] `fetch()` POST to `http://localhost:3000/api/messages`
  - [x] Include `Authorization: Bearer <token>` header
  - [x] Parse and forward response back to content script
- [x] Implement error handling in service worker
  - [x] Exponential backoff on failed POSTs (3 retries: 1s, 4s, 16s)
  - [x] Queue failed messages in `chrome.storage.session`
  - [x] Retry queued messages on next successful connection
- [x] Enhance popup UI
  - [x] Connection health indicator *(tiered: `/health` → `/api/sessions`, April 2026 audit fix)*
  - [x] Last synced timestamp display
  - [ ] Session list with message counts *(backend returns it via `GET /api/sessions`; popup UI not wired yet)*
  - [x] "New Session" button
  - [x] Error notification toasts
- [x] Implement session management
  - [x] Auto-create session on extension install / first launch
  - [x] Store active `session_id` in `chrome.storage.local`
  - [x] Manual session creation from popup
  - [x] Hydrate `activeSessionId` from storage on every SW wake (April 2026 audit fix)
- [x] Store auth token securely
  - [x] Save token via `chrome.storage.local` from popup settings
  - [x] Service worker reads token on demand
- [x] Extension badge
  - [x] Update badge text with sync count
  - [x] Color badge red on error state
- [x] Comprehensive `README.md`
  - [x] Prerequisites (Chrome, Node.js, PostgreSQL)
  - [x] Installation steps (clone, load unpacked, create DB, npm install, configure .env)
  - [x] Architecture overview with diagram
  - [x] Usage guide with screenshots
  - [x] Troubleshooting / FAQ
- [ ] Testing & hardening
  - [ ] Test with multiple Qwen/ChatGPT tabs open simultaneously
  - [ ] Test network failure recovery (kill server mid-sync)
  - [ ] Test incomplete/streaming response extraction guard
  - [ ] Test rapid successive extractions (< 2s apart)
  - [ ] Test long responses (> 10,000 characters)
  - [ ] Test with empty/error ChatGPT responses
- [ ] **✅ Milestone:** 10 consecutive end-to-end cycles complete without failure

---

## Post-Audit Fixes (April 2026)

Applied on branch `fix/extension-bootstrap`, pushed to `amritanshmsh/Extension`.

- [x] **Icons.** Split packaged JPEG `icons` file into proper `icons/` directory with 16/48/128 PNG set so manifest references resolve and the extension loads.
- [x] **Paired archival.** `SEND_TO_CHATGPT` now archives Qwen prompt before ChatGPT dispatch — no more orphan `chatgpt` rows without a matching `qwen` row.
- [x] **SW state hydration.** `getActiveSessionId()` re-reads `chrome.storage.local` on wake — no more phantom auto-sessions after MV3 service-worker restart.
- [x] **Tiered health probe.** Popup now distinguishes server-down / DB-down / invalid-token / no-token states instead of collapsing all into one red dot.
- [x] **Copy-button selector.** Scoped to `copy-turn-action-button` testid so code-block copy buttons streaming in mid-response can't trip premature completion.
- [x] **Dead code removed.** `utils/messaging.js` deleted (wrappers unused; content scripts and SW inline their own `chrome.runtime.sendMessage`).

---

## Stretch Goals

- [ ] Add support for additional LLM platforms (Claude, Gemini)
- [ ] Build a dashboard page (`dashboard.html`) to browse archived sessions
- [ ] Implement export functionality (JSON, CSV, Markdown)
- [ ] Add token counting estimation in metadata
- [ ] Implement rate limiting on the Express server
- [ ] Package for Chrome Web Store distribution

---

## Known Follow-ups (post-audit, not yet planned)

- [ ] Dedupe Qwen archives on retry. If Qwen archive succeeds but ChatGPT dispatch then fails, a user re-trigger produces a duplicate `qwen` row. Mitigation: skip insert when `(session_id, content, created_at within 2s)` matches.
- [ ] Persist `lastSyncTimestamp` across SW wake-ups (currently resets to "Never" in the popup after SW restart — UI-only, no data loss).
- [ ] Show session list with message counts directly in the popup (backend already serves it via `GET /api/sessions`; needs popup UI).
