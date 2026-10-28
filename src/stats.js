/**
 * Statistics of finished games per mode and code length, kept through the
 * storage helper. The functions never change their input.
 */

import { DIGIT_OPTIONS } from './codes.js';
import { MODES } from './game.js';
import { storage } from './storage.js';

const STATS_KEY = 'stats';

/**
 * @typedef {object} StatsEntry
 * @property {number} games Finished games.
 * @property {number} guesses Total guesses over those games.
 * @property {number} best Fewest guesses in one game (0 before the first game).
 */

/** @typedef {Record<string, StatsEntry>} Stats Entries keyed "mode-digits". */

/**
 * @typedef {object} StatsSummary
 * @property {number} games
 * @property {number} average Average guesses per game (0 before the first game).
 * @property {number} best
 */

/**
 * @param {string} mode
 * @param {number} digits
 * @returns {string}
 */
function keyOf(mode, digits) {
  return `${mode}-${digits}`;
}

const VALID_KEYS = new Set(MODES.flatMap((mode) => DIGIT_OPTIONS.map((d) => keyOf(mode, d))));

/**
 * Adds a finished game.
 * @param {Stats} stats
 * @param {'guess'|'solve'} mode
 * @param {number} digits
 * @param {number} guesses Guesses needed in that game.
 * @returns {Stats} Updated copy.
 */
export function recordGame(stats, mode, digits, guesses) {
  const key = keyOf(mode, digits);
  const entry = stats[key] ?? { games: 0, guesses: 0, best: 0 };
  return {
    ...stats,
    [key]: {
      games: entry.games + 1,
      guesses: entry.guesses + guesses,
      best: entry.best === 0 ? guesses : Math.min(entry.best, guesses),
    },
  };
}

/**
 * Games, average and best guesses for one mode and code length.
 * @param {Stats} stats
 * @param {'guess'|'solve'} mode
 * @param {number} digits
 * @returns {StatsSummary}
 */
export function summarize(stats, mode, digits) {
  const entry = stats[keyOf(mode, digits)];
  if (!entry || entry.games === 0) return { games: 0, average: 0, best: 0 };
  return { games: entry.games, average: entry.guesses / entry.games, best: entry.best };
}

/**
 * Keeps only well-formed entries from stored (possibly corrupted) data.
 * @param {unknown} raw
 * @returns {Stats}
 */
export function sanitizeStats(raw) {
  /** @type {Stats} */
  const stats = {};
  if (!raw || typeof raw !== 'object') return stats;
  for (const [key, entry] of Object.entries(raw)) {
    if (VALID_KEYS.has(key) && isEntry(entry)) {
      stats[key] = { games: entry.games, guesses: entry.guesses, best: entry.best };
    }
  }
  return stats;
}

/**
 * @param {any} entry
 * @returns {boolean}
 */
function isEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const { games, guesses, best } = entry;
  return [games, guesses, best].every((n) => Number.isSafeInteger(n) && n >= 0);
}

/**
 * Reads the saved statistics.
 * @param {import('./storage.js').StorageHelper} [store]
 * @returns {Stats}
 */
export function loadStats(store = storage) {
  return sanitizeStats(store.load(STATS_KEY, {}));
}

/**
 * Saves the statistics.
 * @param {Stats} stats
 * @param {import('./storage.js').StorageHelper} [store]
 * @returns {boolean} False when storage is unavailable.
 */
export function saveStats(stats, store = storage) {
  return store.save(STATS_KEY, stats);
}
