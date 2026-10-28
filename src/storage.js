/**
 * Tiny localStorage helper. Every read and write is wrapped in try/catch so
 * private mode, blocked storage or a missing window never break the game.
 * Keys get a prefix because every game on the same GitHub Pages origin
 * shares one localStorage.
 */

const PREFIX = 'bulls-and-cows:';

/**
 * @typedef {object} KeyValueStore
 * @property {(key: string) => (string|null)} getItem
 * @property {(key: string, value: string) => void} setItem
 */

/**
 * @typedef {object} StorageHelper
 * @property {<T>(key: string, fallback: T) => T|unknown} load Parsed JSON, or
 *   `fallback` when the key is missing, unreadable or storage is unavailable.
 * @property {(key: string, value: unknown) => boolean} save Stores JSON;
 *   false when storage is unavailable or full.
 */

/**
 * Creates a helper around a storage backend.
 * @param {() => (KeyValueStore|null|undefined)} [getBackend] Looked up on
 *   every call (never at import time); defaults to window.localStorage.
 * @returns {StorageHelper}
 */
export function createStorage(getBackend = () => globalThis.localStorage) {
  return {
    load(key, fallback) {
      try {
        const raw = getBackend()?.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    save(key, value) {
      try {
        const backend = getBackend();
        if (!backend) return false;
        backend.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** The helper bound to the browser's localStorage. */
export const storage = createStorage();
