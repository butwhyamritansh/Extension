# Deliverables — Qwen↔ChatGPT Bridge Extension

> Complete list of every deliverable artifact, grouped by project component.

---

## 1. Chrome Extension Package

### 1.1 Manifest & Configuration
| File | Type | Description |
|------|------|-------------|
| `manifest.json` | Config | Manifest V3 declaration — permissions, host_permissions, service worker registration, content script injection rules |
| `.gitignore` | Config | Ignore `node_modules/`, `.env`, `*.pem`, `dist/` |

### 1.2 Popup UI
| File | Type | Description |
|------|------|-------------|
| `popup/popup.html` | HTML | Extension popup layout — status panel, session info, trigger buttons |
| `popup/popup.css` | CSS | Popup styling — dark theme, status indicators, animations |
| `popup/popup.js` | JS | Popup logic — fetch status from service worker, manual extraction trigger, session controls |

### 1.3 Service Worker (Background)
| File | Type | Description |
|------|------|-------------|
| `background/service-worker.js` | JS | Central message broker — routes messages between Qwen/ChatGPT content scripts, proxies HTTP requests to local server, manages session state |

### 1.4 Content Scripts
| File | Type | Description |
|------|------|-------------|
| `content_scripts/qwen.js` | JS | Qwen extraction — DOM traversal for latest assistant response, keyboard/button trigger, streaming guard, message dispatch |
| `content_scripts/chatgpt.js` | JS | ChatGPT injection — `execCommand`-based text insertion, send button activation, tiered MutationObserver for response completion detection, response extraction |

### 1.5 Shared Utilities
| File | Type | Description |
|------|------|-------------|
| `utils/constants.js` | JS | Action type enums (`SEND_TO_CHATGPT`, `ARCHIVE_RESPONSE`, etc.), timeout values, version string |
| `utils/selectors.js` | JS | Resilient DOM selector utility — tries primary → secondary → tertiary selectors with logging |
| `utils/messaging.js` | JS | Wrapper functions for `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` with error handling |

### 1.6 Assets
| File | Type | Description |
|------|------|-------------|
| `icons/icon-16.png` | Image | Toolbar icon (16×16) |
| `icons/icon-48.png` | Image | Extension management page icon (48×48) |
| `icons/icon-128.png` | Image | Chrome Web Store icon (128×128) |

---

## 2. Backend Server

### 2.1 Server Core
| File | Type | Description |
|------|------|-------------|
| `server/package.json` | Config | Node.js project manifest — dependencies: `express`, `pg`, `cors`, `dotenv`, `helmet`, `uuid` |
| `server/index.js` | JS | Express application entry point — middleware chain, route mounting, server startup |
| `server/.env.example` | Config | Environment variable template (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `AUTH_TOKEN`, `PORT`) |

### 2.2 Database Layer
| File | Type | Description |
|------|------|-------------|
| `server/db/schema.sql` | SQL | PostgreSQL DDL — `sessions`, `messages`, `metadata` tables with indexes and constraints |
| `server/db/pool.js` | JS | `pg.Pool` singleton — connection pooling config, graceful shutdown handler |

### 2.3 Middleware
| File | Type | Description |
|------|------|-------------|
| `server/middleware/auth.js` | JS | Bearer token validation — extracts `Authorization` header, compares against `AUTH_TOKEN` env var, rejects `401` on mismatch |

### 2.4 API Routes
| File | Type | Description |
|------|------|-------------|
| `server/routes/messages.js` | JS | `POST /api/messages` — validates payload, inserts into `messages` + `metadata`, returns created row |
| `server/routes/sessions.js` | JS | `POST /api/sessions` — create new session; `GET /api/sessions` — list all; `GET /api/sessions/:id/messages` — fetch session history |

---

## 3. Documentation

| File | Type | Description |
|------|------|-------------|
| `README.md` | Markdown | Project overview, architecture diagram, prerequisites, installation guide, development workflow, troubleshooting FAQ |
| `DELIVERABLES.md` | Markdown | This file — complete deliverable inventory |
| `TODO.md` | Markdown | Phase-by-phase task checklist with status tracking |
| `Browser Extension Development Plan.md` | Markdown | Original architectural blueprint and research document |

---

## 4. Quality Assurance (Stretch)

| File | Type | Description |
|------|------|-------------|
| `tests/selectors.test.js` | JS | Jest unit tests for selector resilience utilities |
| `tests/routes.test.js` | JS | Supertest integration tests for Express API routes |
| `tests/e2e.spec.js` | JS | Playwright E2E test — full extraction→injection→archival flow |

---

## Deliverable Summary

| Category | File Count | Status |
|----------|-----------|--------|
| Extension Core | 10 | 🔴 Not Started |
| Backend Server | 7 | 🔴 Not Started |
| Documentation | 4 | 🟡 In Progress |
| QA / Tests | 3 | 🔴 Not Started |
| **Total** | **24** | |
