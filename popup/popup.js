/**
 * popup.js — Qwen↔ChatGPT Bridge Extension Popup Logic
 *
 * Communicates with the service worker to display status,
 * trigger actions, and manage settings.
 */

// ─── DOM References ─────────────────────────────────────────────
const statusDot = document.getElementById("statusDot");
const sessionIdEl = document.getElementById("sessionId");
const lastSyncEl = document.getElementById("lastSync");
const versionEl = document.getElementById("version");
const btnExtract = document.getElementById("btnExtract");
const btnNewSession = document.getElementById("btnNewSession");
const authTokenInput = document.getElementById("authToken");
const btnSaveToken = document.getElementById("btnSaveToken");
const btnToggleToken = document.getElementById("btnToggleToken");
const errorLog = document.getElementById("errorLog");
const errorList = document.getElementById("errorList");

// ─── Initialization ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadSavedToken();
  await refreshStatus();
  await checkServerConnection();
});

// ─── Status Refresh ─────────────────────────────────────────────
async function refreshStatus() {
  try {
    const response = await sendMessage({ action: "GET_STATUS" });
    if (response.success) {
      // Session
      if (response.sessionId) {
        sessionIdEl.textContent = response.sessionId.substring(0, 8) + "…";
        sessionIdEl.title = response.sessionId;
      } else {
        sessionIdEl.textContent = "No active session";
      }

      // Last sync
      if (response.lastSync) {
        const date = new Date(response.lastSync);
        lastSyncEl.textContent = date.toLocaleTimeString();
        lastSyncEl.title = date.toLocaleString();
      } else {
        lastSyncEl.textContent = "Never";
      }

      // Version
      versionEl.textContent = response.version || "1.0.0";

      // Errors
      if (response.errors && response.errors.length > 0) {
        errorLog.style.display = "block";
        errorList.innerHTML = response.errors
          .map(
            (e) =>
              `<li title="${new Date(e.timestamp).toLocaleString()}">[${e.source}] ${e.message}</li>`
          )
          .join("");
      } else {
        errorLog.style.display = "none";
      }
    }
  } catch (err) {
    console.error("[Popup] Failed to refresh status:", err);
  }
}

// ─── Server Connection Check ────────────────────────────────────
async function checkServerConnection() {
  try {
    const { authToken } = await chrome.storage.local.get("authToken");
    if (!authToken) {
      statusDot.classList.remove("connected");
      statusDot.title = "No auth token configured";
      return;
    }

    const response = await fetch("http://localhost:3000/api/sessions", {
      method: "GET",
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (response.ok) {
      statusDot.classList.add("connected");
      statusDot.title = "Connected to server";
    } else {
      statusDot.classList.remove("connected");
      statusDot.title = `Server error: ${response.status}`;
    }
  } catch (err) {
    statusDot.classList.remove("connected");
    statusDot.title = "Server unreachable";
  }
}

// ─── Extract & Send Button ──────────────────────────────────────
btnExtract.addEventListener("click", async () => {
  btnExtract.classList.add("loading");
  btnExtract.querySelector(".btn-icon").textContent = "⏳";

  try {
    const response = await sendMessage({ action: "TRIGGER_EXTRACT" });
    if (response.success) {
      showToast("Extraction triggered! Text will be sent to ChatGPT.", "success");
    } else {
      showToast(response.error || "Extraction failed", "error");
    }
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btnExtract.classList.remove("loading");
    btnExtract.querySelector(".btn-icon").textContent = "📤";
  }
});

// ─── New Session Button ─────────────────────────────────────────
btnNewSession.addEventListener("click", async () => {
  btnNewSession.classList.add("loading");

  try {
    const response = await sendMessage({
      action: "NEW_SESSION",
      title: `Session ${new Date().toLocaleString()}`,
    });
    if (response.success) {
      showToast("New session created", "success");
      await refreshStatus();
    } else {
      showToast(response.error || "Failed to create session", "error");
    }
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btnNewSession.classList.remove("loading");
  }
});

// ─── Auth Token Management ──────────────────────────────────────
async function loadSavedToken() {
  const { authToken } = await chrome.storage.local.get("authToken");
  if (authToken) {
    authTokenInput.value = authToken;
  }
}

btnSaveToken.addEventListener("click", async () => {
  const token = authTokenInput.value.trim();
  if (!token) {
    showToast("Please enter a token", "error");
    return;
  }

  await chrome.storage.local.set({ authToken: token });
  showToast("Token saved", "success");
  await checkServerConnection();
});

btnToggleToken.addEventListener("click", () => {
  const isPassword = authTokenInput.type === "password";
  authTokenInput.type = isPassword ? "text" : "password";
  btnToggleToken.textContent = isPassword ? "🔒" : "👁";
});

// ─── Toast Notifications ────────────────────────────────────────
function showToast(message, type = "success") {
  // Remove any existing toast
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Messaging Helper ───────────────────────────────────────────
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response || {});
    });
  });
}
