/**
 * chatgpt.js — Content script for ChatGPT (chatgpt.com)
 *
 * Receives extracted text from Qwen via the service worker,
 * injects it into the ProseMirror editor using document.execCommand,
 * triggers submission, and detects response completion via
 * a tiered MutationObserver heuristic.
 */

(function () {
  "use strict";

  const BRIDGE_PREFIX = "[Bridge/ChatGPT]";
  let isObserving = false;
  let activeObserver = null;

  console.log(`${BRIDGE_PREFIX} Content script loaded`);

  // ─── Message Listener ───────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "INJECT_TEXT") {
      console.log(
        `${BRIDGE_PREFIX} Received INJECT_TEXT (${message.text.length} chars)`
      );
      handleInjection(message.text)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // async response
    }
    return false;
  });

  // ─── Injection Pipeline ─────────────────────────────────────

  /**
   * Full injection pipeline:
   * 1. Find the input field
   * 2. Clear + inject text using execCommand
   * 3. Click send button
   * 4. Start MutationObserver to detect completion
   * 5. Extract and archive the response
   */
  async function handleInjection(text) {
    try {
      // Step 1: Find the input field
      const inputField = queryResilient(CHATGPT_SELECTORS.inputField);
      if (!inputField) {
        throw new Error("Could not find ChatGPT input field");
      }
      console.log(`${BRIDGE_PREFIX} Found input field`);

      // Step 2: Focus the field
      inputField.focus();
      await sleep(100);

      // Step 3: Clear existing content
      document.execCommand("selectAll");
      await sleep(50);
      document.execCommand("delete");
      await sleep(50);

      // Step 4: Inject text via execCommand('insertText')
      // This is the ONLY reliable way to bypass ProseMirror's state machine
      const success = document.execCommand("insertText", false, text);
      if (!success) {
        console.warn(
          `${BRIDGE_PREFIX} execCommand returned false — trying fallback`
        );
        // Fallback: clipboard-based injection
        await clipboardFallback(inputField, text);
      }
      await sleep(200);

      console.log(`${BRIDGE_PREFIX} Text injected successfully`);

      // Step 5: Count existing copy buttons (for completion detection)
      const initialCopyCount = queryAllResilient(
        CHATGPT_SELECTORS.copyButton
      ).length;
      console.log(
        `${BRIDGE_PREFIX} Initial copy button count: ${initialCopyCount}`
      );

      // Step 6: Click send button
      const sendBtn = queryResilient(CHATGPT_SELECTORS.sendButton);
      if (!sendBtn) {
        throw new Error("Could not find ChatGPT send button");
      }

      sendBtn.click();
      console.log(`${BRIDGE_PREFIX} Send button clicked`);

      // Step 7: Wait for response and extract
      const response = await waitForResponseCompletion(initialCopyCount);
      console.log(
        `${BRIDGE_PREFIX} Response captured (${response.length} chars)`
      );

      // Step 8: Archive the response
      chrome.runtime.sendMessage({
        action: ACTIONS.ARCHIVE_RESPONSE,
        text: response,
        metadata: {
          source: "chatgpt",
          timestamp: Date.now(),
          charCount: response.length,
          model: detectModel(),
        },
      });

      showNotification(`✓ Response archived (${response.length} chars)`, "success");
      return { success: true, charCount: response.length };

    } catch (err) {
      console.error(`${BRIDGE_PREFIX} Injection pipeline failed:`, err);
      showNotification(`Injection failed: ${err.message}`, "error");
      throw err;
    }
  }

  // ─── Clipboard Fallback ─────────────────────────────────────
  async function clipboardFallback(inputField, text) {
    console.log(`${BRIDGE_PREFIX} Attempting clipboard-based injection`);
    try {
      await navigator.clipboard.writeText(text);

      // Simulate Ctrl+V paste
      inputField.focus();
      document.execCommand("paste");
      await sleep(100);

      // Verify text was inserted
      if (inputField.innerText.trim().length === 0) {
        throw new Error("Clipboard fallback also failed");
      }
    } catch (err) {
      console.error(`${BRIDGE_PREFIX} Clipboard fallback error:`, err);
      throw err;
    }
  }

  // ─── Response Completion Detection ──────────────────────────

  /**
   * Tiered MutationObserver strategy to detect when ChatGPT
   * finishes generating its response.
   *
   * Heuristic priority:
   * 1. Copy button appears (most reliable)
   * 2. Stop button disappears
   * 3. Text stability debounce (fallback)
   *
   * @param {number} initialCopyCount - Copy button count before submission
   * @returns {Promise<string>} The extracted response text
   */
  function waitForResponseCompletion(initialCopyCount) {
    return new Promise((resolve, reject) => {
      const TIMEOUT_MS = 120000; // 2 minute absolute timeout
      let resolved = false;

      // Absolute timeout guard
      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          cleanup();
          // Extract whatever we have
          const partial = extractLatestResponse();
          if (partial) {
            console.warn(
              `${BRIDGE_PREFIX} Timeout reached — extracting partial response`
            );
            resolve(partial);
          } else {
            reject(new Error("Response detection timed out after 2 minutes"));
          }
        }
      }, TIMEOUT_MS);

      // ── Debounce timer for tertiary heuristic ──────────────
      let debounceTimer = null;

      function resetDebounce() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!resolved) {
            console.log(
              `${BRIDGE_PREFIX} Text stability debounce triggered (${CONFIG.DEBOUNCE_TIMEOUT_MS}ms silence)`
            );
            finalize();
          }
        }, CONFIG.DEBOUNCE_TIMEOUT_MS);
      }

      function finalize() {
        if (resolved) return;
        resolved = true;
        cleanup();

        const responseText = extractLatestResponse();
        if (responseText) {
          resolve(responseText);
        } else {
          reject(new Error("Response completed but extraction failed"));
        }
      }

      function cleanup() {
        clearTimeout(timeoutTimer);
        if (debounceTimer) clearTimeout(debounceTimer);
        if (activeObserver) {
          activeObserver.disconnect();
          activeObserver = null;
        }
        isObserving = false;
      }

      // ── Find observation target ────────────────────────────
      const chatContainer =
        queryResilient(CHATGPT_SELECTORS.chatContainer) || document.body;

      // ── Create unified MutationObserver ─────────────────────
      isObserving = true;
      let stopButtonSeen = false;

      activeObserver = new MutationObserver((mutations) => {
        if (resolved) return;

        // ─ Primary: Check for new copy button ─────────────────
        const currentCopyCount = queryAllResilient(
          CHATGPT_SELECTORS.copyButton
        ).length;
        if (currentCopyCount > initialCopyCount) {
          console.log(
            `${BRIDGE_PREFIX} ✓ Copy button detected (${initialCopyCount} → ${currentCopyCount})`
          );
          finalize();
          return;
        }

        // ─ Secondary: Check stop button lifecycle ─────────────
        const stopBtn = queryResilient(CHATGPT_SELECTORS.stopButton);
        if (stopBtn) {
          stopButtonSeen = true;
        } else if (stopButtonSeen) {
          // Stop button was present and is now gone → generation complete
          console.log(`${BRIDGE_PREFIX} ✓ Stop button disappeared`);
          // Small delay to let final tokens render
          setTimeout(() => {
            if (!resolved) finalize();
          }, 500);
          return;
        }

        // ─ Tertiary: Reset debounce on any DOM change ─────────
        resetDebounce();
      });

      activeObserver.observe(chatContainer, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      // Start the debounce timer
      resetDebounce();
      console.log(`${BRIDGE_PREFIX} MutationObserver active (3-tier heuristic)`);
    });
  }

  // ─── Response Extraction ────────────────────────────────────

  /**
   * Extract the latest assistant response text from the ChatGPT DOM.
   */
  function extractLatestResponse() {
    // Find all assistant message wrappers
    const assistantNodes = queryAllResilient(
      CHATGPT_SELECTORS.assistantMessage
    );

    if (assistantNodes.length === 0) {
      console.warn(`${BRIDGE_PREFIX} No assistant messages found`);
      return null;
    }

    const lastAssistant = assistantNodes[assistantNodes.length - 1];

    // Try to find the specific text content node
    const textNode = queryResilient(
      CHATGPT_SELECTORS.textContent,
      lastAssistant
    );
    if (textNode) {
      return textNode.innerText.trim();
    }

    // Fallback: full assistant node text
    return lastAssistant.innerText.trim();
  }

  /**
   * Attempt to detect which ChatGPT model is active.
   */
  function detectModel() {
    // Look for model selector or label in the DOM
    const modelIndicators = [
      '[data-testid*="model"]',
      '[class*="model-selector"]',
      'button[class*="model"]',
    ];

    for (const selector of modelIndicators) {
      try {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          return el.textContent.trim();
        }
      } catch {
        // Skip invalid selectors
      }
    }

    return "unknown";
  }

  // ─── Utilities ──────────────────────────────────────────────

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── On-Page Notification ───────────────────────────────────
  function showNotification(message, type = "success") {
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
    requestAnimationFrame(() => {
      notif.style.transform = "translateX(0)";
    });

    setTimeout(() => {
      notif.style.transform = "translateX(120%)";
      setTimeout(() => notif.remove(), 300);
    }, 4000);
  }
})();
