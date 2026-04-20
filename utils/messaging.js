/**
 * messaging.js — Shared messaging helpers for Qwen↔ChatGPT Bridge Extension
 * Wraps chrome.runtime and chrome.tabs messaging APIs with error handling.
 */

/**
 * Send a message to the service worker (background script).
 * Automatically wraps the payload with a timestamp.
 *
 * @param {string} action - Action type from ACTIONS constant.
 * @param {Object} [data={}] - Additional payload data.
 * @returns {Promise<any>} Response from the service worker.
 */
function sendToBackground(action, data = {}) {
  return new Promise((resolve, reject) => {
    const message = {
      action,
      timestamp: Date.now(),
      ...data,
    };

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          `[Bridge] sendToBackground error (${action}):`,
          chrome.runtime.lastError.message
        );
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Send a message to a specific tab's content script.
 * Used by the service worker to relay payloads.
 *
 * @param {number} tabId - Target tab ID.
 * @param {string} action - Action type from ACTIONS constant.
 * @param {Object} [data={}] - Additional payload data.
 * @returns {Promise<any>} Response from the content script.
 */
function sendToTab(tabId, action, data = {}) {
  return new Promise((resolve, reject) => {
    const message = {
      action,
      timestamp: Date.now(),
      ...data,
    };

    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          `[Bridge] sendToTab error (tab=${tabId}, ${action}):`,
          chrome.runtime.lastError.message
        );
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Find the best matching tab for a given URL pattern.
 * Prioritizes: active tab in current window → active in any window → first match.
 *
 * @param {string} urlPattern - URL match pattern (e.g. "*://*.chatgpt.com/*").
 * @returns {Promise<chrome.tabs.Tab|null>} The best matching tab, or null.
 */
async function findBestTab(urlPattern) {
  // Try active tab in current window first
  let tabs = await chrome.tabs.query({
    url: urlPattern,
    active: true,
    currentWindow: true,
  });

  if (tabs.length > 0) return tabs[0];

  // Try active in last focused window
  tabs = await chrome.tabs.query({
    url: urlPattern,
    active: true,
    lastFocusedWindow: true,
  });

  if (tabs.length > 0) return tabs[0];

  // Fall back to any matching tab
  tabs = await chrome.tabs.query({ url: urlPattern });

  if (tabs.length > 0) {
    console.warn(
      `[Bridge] No active tab for ${urlPattern}, using first match (tab ${tabs[0].id})`
    );
    return tabs[0];
  }

  console.warn(`[Bridge] No tabs found matching ${urlPattern}`);
  return null;
}
