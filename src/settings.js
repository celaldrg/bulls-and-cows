/**
 * Saved preferences: the open mode tab, the code settings, the solver level
 * and the language. Everything goes through the storage helper and is
 * normalized on the way in, so stale or corrupted data never breaks the page.
 */

import { normalizeConfig } from './codes.js';
import { MODES } from './game.js';
import { normalizeLanguage } from './i18n.js';
import { LEVELS } from './solver.js';
import { storage } from './storage.js';

const SETTINGS_KEY = 'settings';
const LANGUAGE_KEY = 'lang';

/**
 * @typedef {object} Settings
 * @property {'guess'|'solve'} mode The open tab.
 * @property {number} digits Code length (3-5).
 * @property {boolean} leadingZero Whether codes may start with 0.
 * @property {'hard'|'easy'} level Solver strength in 'solve' mode.
 */

/**
 * Turns any (possibly stored) value into valid settings; unknown or broken
 * fields fall back to the defaults.
 * @param {unknown} [raw]
 * @returns {Settings}
 */
export function normalizeSettings(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  return {
    mode: MODES.includes(source.mode) ? source.mode : MODES[0],
    ...normalizeConfig(source),
    level: LEVELS.includes(source.level) ? source.level : LEVELS[0],
  };
}

/**
 * Reads the saved settings.
 * @param {import('./storage.js').StorageHelper} [store]
 * @returns {Settings}
 */
export function loadSettings(store = storage) {
  return normalizeSettings(store.load(SETTINGS_KEY, null));
}

/**
 * Saves the settings (normalized first).
 * @param {Settings} settings
 * @param {import('./storage.js').StorageHelper} [store]
 * @returns {boolean} False when storage is unavailable.
 */
export function saveSettings(settings, store = storage) {
  return store.save(SETTINGS_KEY, normalizeSettings(settings));
}

/**
 * Reads the saved language (English when none is saved).
 * @param {import('./storage.js').StorageHelper} [store]
 * @returns {string}
 */
export function loadLanguage(store = storage) {
  return normalizeLanguage(store.load(LANGUAGE_KEY, null));
}

/**
 * Saves the chosen language.
 * @param {string} lang
 * @param {import('./storage.js').StorageHelper} [store]
 * @returns {boolean} False when storage is unavailable.
 */
export function saveLanguage(lang, store = storage) {
  return store.save(LANGUAGE_KEY, normalizeLanguage(lang));
}
