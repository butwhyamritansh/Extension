/**
 * service-worker.js — Central message broker for Qwen↔ChatGPT Bridge
 * 
 * Manifest V3 service worker. Event-driven, no persistent state.
 * Routes messages between content scripts and proxies HTTP to the local backend.
 */

// ─── State (transient — lost on service worker restart) ─────────
let activeSessionId = null;
let lastSyncTimestamp = null;
let pendingErrors = [];

// ─── Initialization ─────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[Bridge SW] Installed (reason: ${details.reason})`);

  // Restore session from storage
  const stored = await chrome.storage.local.get(["sessionId", "authToken"]);
  if (stored.sessionId) {
    activeSessionId = stored.sessionId;
    console.log(`[Bridge SW] Restored session: ${activeSessionId}`);
  }
});

// ─── Message Router ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`[Bridge SW] Received action: ${message.action}`, message);

  // We must return true to indicate async response
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((err) => {
      console.error(`[Bridge SW] Error handling ${message.action}:`, err);
      sendResponse({ success: false, error: err.message });
    });

  return true; // Keep the message channel open for async response
});

/**
 * Central message dispatcher.
 */
async function handleMessage(message, sender) {
  switch (message.action) {

    // ── Qwen extracted text → route to ChatGPT ──────────────────
    case "SEND_TO_CHATGPT": {
      const tab = await findChatGPTTab();
      if (!tab) {
        throw new Error("No ChatGPT tab found. Please open chatgpt.com first.");
      }

      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          tab.id,
          { action: "INJECT_TEXT", text: message.text, timestamp: Date.now() },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve({ success: true, tabId: tab.id, ...response });
          }
        );
      });
    }

    // ── ChatGPT response → archive to backend ──────────────────
    case "ARCHIVE_RESPONSE": {
      const result = await archiveToBackend(message);
      lastSyncTimestamp = Date.now();
      updateBadge("✓", "#22c55e");
      return { success: true, ...result };
    }

    // ── Popup: get current status ───────────────────────────────
    case "GET_STATUS": {
      return {
        success: true,
        sessionId: activeSessionId,
        lastSync: lastSyncTimestamp,
        errors: pendingErrors.slice(-5), // Last 5 errors
        version: "1.0.0",
      };
    }

    // ── Popup: create new session ───────────────────────────────
    case "NEW_SESSION": {
      const session = await createSession(message.title || null);
      activeSessionId = session.session_id;
      await chrome.storage.local.set({ sessionId: activeSessionId });
      return { success: true, session };
    }

    // ── Popup: trigger extraction from Qwen ─────────────────────
    case "TRIGGER_EXTRACT": {
      const qwenTab = await findQwenTab();
      if (!qwenTab) {
        throw new Error("No Qwen tab found. Please open chat.qwen.ai first.");
      }

      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          qwenTab.id,
          { action: "TRIGGER_EXTRACT", timestamp: Date.now() },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve({ success: true, ...response });
          }
        );
      });
    }

    // ── Error reporting ─────────────────────────────────────────
    case "REPORT_ERROR": {
      pendingErrors.push({
        message: message.error,
        source: message.source,
        timestamp: Date.now(),
      });
      updateBadge("!", "#ef4444");
      return { success: true };
    }

    default:
      console.warn(`[Bridge SW] Unknown action: ${message.action}`);
      return { success: false, error: `Unknown action: ${message.action}` };
  }
}

// ─── Tab Discovery ──────────────────────────────────────────────

async function findChatGPTTab() {
  // Priority: active in current window → active anywhere → any match
  let tabs = await chrome.tabs.query({
    url: "*://*.chatgpt.com/*",
    active: true,
    currentWindow: true,
  });
  if (tabs.length > 0) return tabs[0];

  tabs = await chrome.tabs.query({
    url: "*://*.chatgpt.com/*",
    active: true,
    lastFocusedWindow: true,
  });
  if (tabs.length > 0) return tabs[0];

  tabs = await chrome.tabs.query({ url: "*://*.chatgpt.com/*" });
  return tabs.length > 0 ? tabs[0] : null;
}

async function findQwenTab() {
  let tabs = await chrome.tabs.query({
    url: "*://*.qwen.ai/*",
    active: true,
    currentWindow: true,
  });
  if (tabs.length > 0) return tabs[0];

  tabs = await chrome.tabs.query({
    url: "*://*.qwen.ai/*",
    active: true,
    lastFocusedWindow: true,
  });
  if (tabs.length > 0) return tabs[0];

  tabs = await chrome.tabs.query({ url: "*://*.qwen.ai/*" });
  return tabs.length > 0 ? tabs[0] : null;
}

// ─── Backend Communication ──────────────────────────────────────

/**
 * POST extracted response to the local Express server.
 * Implements exponential backoff on failure.
 */
async function archiveToBackend(message, retryCount = 0) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000;

  // Retrieve auth token from storage
  const { authToken } = await chrome.storage.local.get("authToken");
  if (!authToken) {
    throw new Error("Auth token not configured. Set it in the extension popup.");
  }

  // Ensure we have an active session
  if (!activeSessionId) {
    const session = await createSession("Auto-created session");
    activeSessionId = session.session_id;
    await chrome.storage.local.set({ sessionId: activeSessionId });
  }

  const payload = {
    session_id: activeSessionId,
    role: message.metadata?.source || "chatgpt",
    content: message.text,
    metadata: {
      source_platform: message.metadata?.source || "chatgpt",
      model_version: message.metadata?.model || null,
      token_estimate: message.text ? Math.ceil(message.text.length / 4) : 0,
    },
  };

  try {
    const response = await fetch("http://localhost:3000/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("[Bridge SW] Archived successfully:", result);
    return result;

  } catch (err) {
    console.error(`[Bridge SW] Archive attempt ${retryCount + 1} failed:`, err.message);

    if (retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(4, retryCount);
      console.log(`[Bridge SW] Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return archiveToBackend(message, retryCount + 1);
    }

    // Store failed message for later retry
    const { failedMessages = [] } = await chrome.storage.session.get("failedMessages");
    failedMessages.push({ payload, timestamp: Date.now() });
    await chrome.storage.session.set({ failedMessages });

    throw new Error(`Archive failed after ${MAX_RETRIES + 1} attempts: ${err.message}`);
  }
}

/**
 * Create a new session on the backend.
 */
async function createSession(title) {
  const { authToken } = await chrome.storage.local.get("authToken");
  if (!authToken) {
    throw new Error("Auth token not configured.");
  }

  const response = await fetch("http://localhost:3000/api/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ title: title || `Session ${new Date().toLocaleString()}` }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`);
  }

  return response.json();
}

// ─── Badge Utility ──────────────────────────────────────────────

function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  // Clear badge after 3 seconds
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
}
