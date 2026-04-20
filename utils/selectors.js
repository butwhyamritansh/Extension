/**
 * selectors.js — Resilient DOM selector utilities
 * Tries multiple selectors in priority order and logs warnings on fallback usage.
 */

/**
 * Query the DOM using a chain of selectors, returning the first match.
 * Logs a warning to the console if the primary selector fails.
 *
 * @param {string[]} selectorChain - Array of CSS selectors, ordered by reliability.
 * @param {Element|Document} [root=document] - Root element to query within.
 * @returns {Element|null} The first matching element, or null if none found.
 */
function queryResilient(selectorChain, root = document) {
  if (!Array.isArray(selectorChain) || selectorChain.length === 0) {
    console.error("[Bridge] queryResilient: empty selector chain provided");
    return null;
  }

  for (let i = 0; i < selectorChain.length; i++) {
    const selector = selectorChain[i];
    try {
      const element = root.querySelector(selector);
      if (element) {
        if (i > 0) {
          console.warn(
            `[Bridge] Primary selector "${selectorChain[0]}" failed. ` +
            `Fell back to selector #${i + 1}: "${selector}"`
          );
        }
        return element;
      }
    } catch (err) {
      console.warn(`[Bridge] Invalid selector "${selector}":`, err.message);
    }
  }

  console.warn(
    `[Bridge] All selectors failed:`,
    selectorChain.join(" → ")
  );
  return null;
}

/**
 * Query the DOM for ALL matching elements using a chain of selectors.
 * Returns results from the first selector that yields at least one match.
 *
 * @param {string[]} selectorChain - Array of CSS selectors, ordered by reliability.
 * @param {Element|Document} [root=document] - Root element to query within.
 * @returns {Element[]} Array of matching elements (may be empty).
 */
function queryAllResilient(selectorChain, root = document) {
  if (!Array.isArray(selectorChain) || selectorChain.length === 0) {
    console.error("[Bridge] queryAllResilient: empty selector chain provided");
    return [];
  }

  for (let i = 0; i < selectorChain.length; i++) {
    const selector = selectorChain[i];
    try {
      const elements = root.querySelectorAll(selector);
      if (elements.length > 0) {
        if (i > 0) {
          console.warn(
            `[Bridge] Primary selector "${selectorChain[0]}" failed. ` +
            `Fell back to selector #${i + 1}: "${selector}"`
          );
        }
        return Array.from(elements);
      }
    } catch (err) {
      console.warn(`[Bridge] Invalid selector "${selector}":`, err.message);
    }
  }

  console.warn(
    `[Bridge] All selectors failed (queryAll):`,
    selectorChain.join(" → ")
  );
  return [];
}

/**
 * Wait for an element matching the selector chain to appear in the DOM.
 * Uses MutationObserver internally. Resolves when found, rejects on timeout.
 *
 * @param {string[]} selectorChain - Selector chain to watch for.
 * @param {number} [timeoutMs=10000] - Maximum wait time in milliseconds.
 * @param {Element|Document} [root=document] - Root to observe.
 * @returns {Promise<Element>} Resolves with the found element.
 */
function waitForElement(selectorChain, timeoutMs = 10000, root = document) {
  return new Promise((resolve, reject) => {
    // Check immediately first
    const existing = queryResilient(selectorChain, root);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = queryResilient(selectorChain, root);
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(
        new Error(
          `[Bridge] waitForElement timed out after ${timeoutMs}ms: ${selectorChain.join(" → ")}`
        )
      );
    }, timeoutMs);

    observer.observe(root === document ? document.body : root, {
      childList: true,
      subtree: true,
    });
  });
}
