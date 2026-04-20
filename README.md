# ⚡ Qwen↔ChatGPT Bridge

A Manifest V3 Chrome extension that bridges **Qwen** and **ChatGPT** — extract AI responses from one, inject into the other, and archive everything to a local PostgreSQL database.

---

## Architecture

```
┌─────────────────────── Chrome Browser ───────────────────────┐
│                                                               │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐  │
│  │  Qwen Tab     │     │  Service      │    │  ChatGPT Tab │  │
│  │  Content      │────▶│  Worker       │───▶│  Content     │  │
│  │  Script       │     │  (Broker)     │    │  Script      │  │
│  └──────────────┘     └──────┬───────┘    └──────────────┘  │
│                              │                                │
└──────────────────────────────┼────────────────────────────────┘
                               │ HTTP POST
                               ▼
                  ┌─────────────────────────┐
                  │  Express Server (:3000)  │
                  │  ├─ Auth Middleware      │
                  │  ├─ Sessions API        │
                  │  └─ Messages API        │
                  └───────────┬─────────────┘
                              │
                              ▼
                  ┌─────────────────────────┐
                  │  PostgreSQL Database     │
                  │  ├─ sessions             │
                  │  ├─ messages             │
                  │  └─ metadata             │
                  └─────────────────────────┘
```

---

## Prerequisites

- **Chrome** (or Chromium-based browser)
- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14

---

## Quick Start

### 1. Clone & Setup
```bash
git clone <repo-url>
cd Extension
```

### 2. Setup the Database
```bash
# Create the database
createdb llm_bridge

# Run the schema
psql -d llm_bridge -f server/db/schema.sql
```

### 3. Configure the Server
```bash
cd server
cp .env.example .env
# Edit .env with your DB credentials and generate an auth token:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Install & Start the Server
```bash
cd server
npm install
npm run dev
```

### 5. Load the Extension
1. Open Chrome → navigate to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `Extension/` directory (the one containing `manifest.json`)
5. The ⚡ icon should appear in your toolbar

### 6. Configure the Extension
1. Click the ⚡ extension icon
2. Enter your auth token (same one from `.env`)
3. Click **Save Token**
4. The status dot should turn **green** ●

---

## Usage

1. Open **chat.qwen.ai** in one tab
2. Open **chatgpt.com** in another tab
3. Generate a response in Qwen
4. Either:
   - Press **Ctrl+Shift+Q** on the Qwen page, or
   - Click the floating **⚡ Extract & Send** button
5. The text is automatically:
   - Injected into ChatGPT's input
   - Submitted
   - The response is captured and archived to PostgreSQL

---

## Project Structure

```
Extension/
├── manifest.json              # MV3 configuration
├── popup/                     # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/
│   └── service-worker.js      # Central message broker
├── content_scripts/
│   ├── qwen.js                # Qwen extraction
│   └── chatgpt.js             # ChatGPT injection + observation
├── utils/
│   ├── constants.js            # Shared constants & selectors
│   ├── selectors.js            # Resilient DOM querying
│   └── messaging.js            # Message wrappers
├── icons/                     # Extension icons
├── server/                    # Backend server
│   ├── index.js               # Express entry point
│   ├── package.json
│   ├── .env.example
│   ├── middleware/auth.js     # Token auth
│   ├── routes/
│   │   ├── sessions.js
│   │   └── messages.js
│   └── db/
│       ├── pool.js            # PG connection pool
│       └── schema.sql         # Database schema
└── README.md
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Extension won't load | Check `chrome://extensions` for errors. Make sure `manifest.json` is valid JSON. |
| Status dot is red | Ensure the Express server is running on port 3000 and the auth token matches. |
| Text not injecting into ChatGPT | ChatGPT may have updated their DOM. Check console for selector warnings. |
| `ERR_CERT_AUTHORITY_INVALID` on localhost | Some Chromium builds reject HTTP from service workers. Try HTTPS with a self-signed cert. |
| MutationObserver never triggers | ChatGPT UI may have changed. Check `CHATGPT_SELECTORS` in `constants.js`. |

---

## License

Private — Internal use only.
