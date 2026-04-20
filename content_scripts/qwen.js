/**
 * qwen.js — Content script for Qwen (chat.qwen.ai)
 *
 * Extracts the latest assistant response from the Qwen DOM and
 * dispatches it to the service worker for routing to the ChatGPT tab.
 */

(function () {
  "use strict";

  const BRIDGE_PREFIX = "[Bridge/Qwen]";
  let isExtracting = false;

  // ─── Initialization ─────────────────────────────────────────
  console.log(`${BRIDGE_PREFIX} Content script loaded`);
  setupKeyboardShortcut();
  injectExtractButton();

  // ─── Keyboard Shortcut (Ctrl+Shift+Q) ───────────────────────
  function setupKeyboardShortcut() {
    document.addEventListener("keydown", (e) => {
      if (
        e.ctrlKey &&
        e.shiftKey &&
        e.key.toUpperCase() === CONFIG.EXTRACT_SHORTCUT.key
      ) {
        e.preventDefault();
        extractAndSend();
      }
    });
    console.log(`${BRIDGE_PREFIX} Keyboard shortcut registered (Ctrl+Shift+Q)`);
  }

  // ─── Injected UI Button ─────────────────────────────────────
  function injectExtractButton() {
    // Wait for the page to settle before injecting
    setTimeout(() => {
      // Avoid duplicates
      if (document.getElementById("bridge-extract-btn")) return;

      const btn = document.createElement("button");
      btn.id = "bridge-extract-btn";
      btn.textContent = "⚡ Extract & Send";
      btn.title = "Extract latest Qwen response and send to ChatGPT (Ctrl+Shift+Q)";

      // Styles
      Object.assign(btn.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: "99999",
        padding: "10px 18px",
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        color: "#fff",
        border: "none",
        borderRadius: "12px",
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: "13px",
        fontWeight: "600",
        cursor: "pointer",
        boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",
        transition: "all 0.2s ease",
        opacity: "0.9",
      });

      btn.addEventListener("mouseenter", () => {
        btn.style.opacity = "1";
        btn.style.transform = "scale(1.05)";
        btn.style.boxShadow = "0 6px 28px rgba(99, 102, 241, 0.6)";
      });

      btn.addEventListener("mouseleave", () => {
        btn.style.opacity = "0.9";
        btn.style.transform = "scale(1)";
        btn.style.boxShadow = "0 4px 20px rgba(99, 102, 241, 0.4)";
      });

      btn.addEventListener("click", extractAndSend);
      document.body.appendChild(btn);
      console.log(`${BRIDGE_PREFIX} Extract button injected`);
    }, 2000);
  }

  // ─── Extraction Logic ───────────────────────────────────────
  function extractAndSend() {
    if (isExtracting) {
      console.warn(`${BRIDGE_PREFIX} Extraction already in progress`);
      return;
    }
    isExtracting = true;

    try {
      const text = extractLatestResponse();
      if (!text) {
        showNotification("No assistant response found on this page.", "error");
        return;
      }

      console.log(`${BRIDGE_PREFIX} Extracted text (${text.length} chars)`);

      // Check if response might still be streaming
      if (isStillGenerating()) {
        showNotification(
          "⚠ Qwen appears to still be generating. Text may be truncated.",
          "warning"
        );
      }

      // Dispatch to service worker
      chrome.runtime.sendMessage(
        {
          action: ACTIONS.SEND_TO_CHATGPT,
          text: text,
          metadata: {
            source: "qwen",
            timestamp: Date.now(),
            charCount: text.length,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              `${BRIDGE_PREFIX} Send failed:`,
              chrome.runtime.lastError.message
            );
            showNotification("Failed to send to ChatGPT.", "error");
            return;
          }

          if (response && response.success) {
            showNotification(
              `✓ Sent ${text.length} chars to ChatGPT`,
              "success"
            );
          } else {
            showNotification(
              response?.error || "Unknown error sending to ChatGPT",
              "error"
            );
          }
        }
      );
    } catch (err) {
      console.error(`${BRIDGE_PREFIX} Extraction error:`, err);
      showNotification(`Extraction failed: ${err.message}`, "error");
    } finally {
      isExtracting = false;
    }
  }

  /**
   * Extract the latest assistant response from the Qwen DOM.
   * Uses the resilient selector chain from constants.js.
   */
  function extractLatestResponse() {
    // Strategy 1: Find all assistant message nodes, pick the last one
    const assistantNodes = queryAllResilient(QWEN_SELECTORS.assistantMessage);

    if (assistantNodes.length > 0) {
      const lastAssistant = assistantNodes[assistantNodes.length - 1];

      // Try to get the text content sub-node first
      const textNode = queryResilient(QWEN_SELECTORS.textContent, lastAssistant);
      if (textNode) {
        return textNode.innerText.trim();
      }

      // Fallback: use the full assistant node's innerText
      return lastAssistant.innerText.trim();
    }

    // Strategy 2: Heuristic — find the chat container, get its last child
    const chatContainer = queryResilient(QWEN_SELECTORS.chatContainer);
    if (chatContainer) {
      const children = chatContainer.children;
      if (children.length >= 2) {
        // Last child is typically the latest message (assistant)
        const lastChild = children[children.length - 1];
        const text = lastChild.innerText.trim();
        if (text.length > 0) {
          console.warn(
            `${BRIDGE_PREFIX} Used heuristic fallback for extraction`
          );
          return text;
        }
      }
    }

    return null;
  }

  /**
   * Check if Qwen appears to still be generating a response.
   * Looks for common streaming indicators in the DOM.
   */
  function isStillGenerating() {
    // Check for a "stop" or "regenerate" button that indicates active generation
    const stopIndicators = [
      'button[class*="stop"]',
      '[aria-label*="Stop"]',
      '[class*="loading"]',
      '[class*="generating"]',
    ];

    for (const selector of stopIndicators) {
      try {
        if (document.querySelector(selector)) {
          return true;
        }
      } catch {
        // Invalid selector, skip
      }
    }

    return false;
  }

  // ─── Listen for external triggers (from popup) ──────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "TRIGGER_EXTRACT") {
      extractAndSend();
      sendResponse({ success: true });
    }
    return false;
  });

  // ─── On-Page Notification ───────────────────────────────────
  function showNotification(message, type = "success") {
    // Remove existing notification
    const existing = document.getElementById("bridge-notification");
    if (existing) existing.remove();

    const notif = document.createElement("div");
    notif.id = "bridge-notification";
    notif.textContent = message;

    const colors = {
      success: { bg: "rgba(34, 197, 94, 0.95)", border: "#22c55e" },
      error: { bg: "rgba(239, 68, 68, 0.95)", border: "#ef4444" },
      warning: { bg: "rgba(234, 179, 8, 0.95)", border: "#eab308" },
    };
    const c = colors[type] || colors.success;

    Object.assign(notif.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: "100000",
      padding: "12px 20px",
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: "#fff",
      borderRadius: "10px",
      fontFamily: "'Inter', -apple-system, sans-serif",
      fontSize: "13px",
      fontWeight: "500",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      backdropFilter: "blur(10px)",
      transition: "all 0.3s ease",
      transform: "translateX(120%)",
      maxWidth: "360px",
      wordBreak: "break-word",
    });

    document.body.appendChild(notif);

    // Slide in
    requestAnimationFrame(() => {
      notif.style.transform = "translateX(0)";
    });

    // Auto-dismiss
    setTimeout(() => {
      notif.style.transform = "translateX(120%)";
      setTimeout(() => notif.remove(), 300);
    }, 4000);
  }
})();
