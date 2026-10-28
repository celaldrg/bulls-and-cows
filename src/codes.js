/**
 * Codes, settings and scoring for Bulls and Cows.
 * A code is a string of distinct digits such as "0123".
 */

import { randomInt } from './rng.js';

/** Code lengths offered in the settings. */
export const DIGIT_OPTIONS = Object.freeze([3, 4, 5]);

/**
 * @typedef {object} Config
 * @property {number} digits Code length (3, 4 or 5).
 * @property {boolean} leadingZero Whether a code may start with 0.
 */

/** @type {Readonly<Config>} */
export const DEFAULT_CONFIG = Object.freeze({ digits: 4, leadingZero: true });

/**
 * Turns any (possibly stored or user supplied) value into a valid config.
 * @param {unknown} [raw] Ideally a Partial<Config>; anything else gives the defaults.
 * @returns {Config}
 */
export function normalizeConfig(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  const digits = DIGIT_OPTIONS.includes(source.digits) ? source.digits : DEFAULT_CONFIG.digits;
  const leadingZero =
    typeof source.leadingZero === 'boolean' ? source.leadingZero : DEFAULT_CONFIG.leadingZero;
  return { digits, leadingZero };
}

/** @type {Map<string, readonly string[]>} */
const codeCache = new Map();

/**
 * Every valid code for a config, in ascending order. The array is cached and frozen.
 * @param {Config} config
 * @returns {readonly string[]}
 */
export function allCodes(config) {
  const key = `${config.digits}:${config.leadingZero}`;
  let codes = codeCache.get(key);
  if (!codes) {
    codes = Object.freeze(generateCodes(config.digits, config.leadingZero));
    codeCache.set(key, codes);
  }
  return codes;
}

/**
 * Builds all codes of distinct digits in lexicographic order.
 * @param {number} length
 * @param {boolean} leadingZero
 * @returns {string[]}
 */
function generateCodes(length, leadingZero) {
  const codes = [];
  const extend = (prefix) => {
    if (prefix.length === length) {
      codes.push(prefix);
      return;
    }
    for (let d = 0; d <= 9; d++) {
      const digit = String(d);
      const blocked = prefix.includes(digit) || (d === 0 && prefix === '' && !leadingZero);
      if (!blocked) extend(prefix + digit);
    }
  };
  extend('');
  return codes;
}

/**
 * @typedef {object} Score
 * @property {number} bulls Right digit in the right place.
 * @property {number} cows Right digit in the wrong place.
 */

/**
 * Scores a guess against a secret. Both must be codes of distinct digits
 * with the same length.
 * @param {string} secret
 * @param {string} guess
 * @returns {Score}
 */
export function score(secret, guess) {
  let bulls = 0;
  let cows = 0;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) bulls++;
    else if (secret.includes(guess[i])) cows++;
  }
  return { bulls, cows };
}

/**
 * @typedef {'length'|'digits'|'distinct'|'leadingZero'} CodeError
 */

/**
 * Checks that a string is a valid code for the config.
 * @param {string} code
 * @param {Config} config
 * @returns {CodeError|null} The first problem found, or null when valid.
 */
export function validateCode(code, config) {
  if (typeof code !== 'string' || code.length !== config.digits) return 'length';
  if (!/^[0-9]+$/.test(code)) return 'digits';
  if (new Set(code).size !== code.length) return 'distinct';
  if (!config.leadingZero && code[0] === '0') return 'leadingZero';
  return null;
}

/**
 * @typedef {'full'|'distinct'|'leadingZero'} DigitError
 */

/**
 * Why a digit may not be typed next while entering a code: the code is
 * already full, the digit is already used, or it would be a forbidden
 * leading zero.
 * @param {string} partial The digits typed so far.
 * @param {number} digit 0-9.
 * @param {Config} config
 * @returns {DigitError|null} Null when the digit may be typed.
 */
export function appendDigitError(partial, digit, config) {
  if (partial.length >= config.digits) return 'full';
  if (partial.includes(String(digit))) return 'distinct';
  if (!config.leadingZero && partial.length === 0 && digit === 0) return 'leadingZero';
  return null;
}

/**
 * Whether a digit may be typed next while entering a code: it must not be
 * used yet, the code must not be full, and the leading zero rule must hold.
 * @param {string} partial The digits typed so far.
 * @param {number} digit 0-9.
 * @param {Config} config
 * @returns {boolean}
 */
export function canAppendDigit(partial, digit, config) {
  return appendDigitError(partial, digit, config) === null;
}

/**
 * Whether bulls/cows could be the answer to some guess: non-negative
 * integers, at most `digits` in total, and never "all but one bull plus one
 * cow" (the last digit would then be a bull as well).
 * @param {number} bulls
 * @param {number} cows
 * @param {number} digits Code length.
 * @returns {boolean}
 */
export function isPossibleAnswer(bulls, cows, digits) {
  if (!Number.isInteger(bulls) || !Number.isInteger(cows)) return false;
  if (bulls < 0 || cows < 0 || bulls + cows > digits) return false;
  return !(bulls === digits - 1 && cows === 1);
}

/**
 * Moves the bulls or the cows of an answer being entered by `delta`, as long
 * as both stay non-negative and together fit in the code length. A step
 * outside that range returns the answer unchanged. Impossible answers inside
 * the range (see isPossibleAnswer) are allowed, so they can be stepped through.
 * @param {Score} answer
 * @param {'bulls'|'cows'} field
 * @param {number} delta Usually +1 or -1.
 * @param {number} digits Code length.
 * @returns {Score}
 */
export function stepAnswer(answer, field, delta, digits) {
  const next = { ...answer, [field]: answer[field] + delta };
  return next[field] >= 0 && next.bulls + next.cows <= digits ? next : answer;
}

/**
 * Picks a uniformly random secret.
 * @param {Config} config
 * @param {import('./rng.js').Rng} rng
 * @returns {string}
 */
export function randomCode(config, rng) {
  const codes = allCodes(config);
  return codes[randomInt(rng, codes.length)];
}
