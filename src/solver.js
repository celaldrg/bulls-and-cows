/**
 * The computer's side: it keeps every code that is still consistent with
 * the answers and chooses its next guess.
 *  - hard: Knuth-style minimax over all codes (smallest worst-case group).
 *  - easy: a random code that is still consistent.
 */

import { allCodes, score } from './codes.js';
import { randomInt } from './rng.js';

/** @typedef {import('./codes.js').Config} Config */

/**
 * @typedef {object} Answer A guess together with its bulls and cows.
 * @property {string} guess
 * @property {number} bulls
 * @property {number} cows
 */

/** Solver strengths offered in the settings. */
export const LEVELS = Object.freeze(['hard', 'easy']);

/**
 * Whether `code`, as the secret, would produce exactly this answer.
 * @param {string} code
 * @param {Answer} answer
 * @returns {boolean}
 */
function fits(code, { guess, bulls, cows }) {
  const result = score(code, guess);
  return result.bulls === bulls && result.cows === cows;
}

/**
 * Keeps the candidates that would produce the given answer (order is kept).
 * @param {readonly string[]} candidates
 * @param {Answer} answer
 * @returns {string[]}
 */
export function filterCandidates(candidates, answer) {
  return candidates.filter((code) => fits(code, answer));
}

/**
 * All codes consistent with every answer, in ascending order.
 * @param {Config} config
 * @param {readonly Answer[]} history
 * @returns {string[]}
 */
export function consistentCodes(config, history) {
  return allCodes(config).filter((code) => history.every((answer) => fits(code, answer)));
}

/**
 * Explains a contradiction. When no code fits the earlier answers together
 * with the new one, returns the indices of a minimal set of earlier answers
 * that clash with it: dropping any one of them would resolve the clash.
 * An empty array means the new answer is impossible on its own.
 * @param {Config} config
 * @param {readonly Answer[]} history Earlier answers.
 * @param {Answer} answer The new answer.
 * @returns {number[]|null} Null when there is no contradiction.
 */
export function findConflict(config, history, answer) {
  const codes = allCodes(config);
  const satisfiable = (indices) =>
    codes.some((code) => fits(code, answer) && indices.every((i) => fits(code, history[i])));
  let kept = history.map((_, i) => i);
  if (satisfiable(kept)) return null;
  for (const i of history.keys()) {
    const without = kept.filter((k) => k !== i);
    if (!satisfiable(without)) kept = without;
  }
  return kept;
}

/**
 * Easy strategy: any code that could still be the secret.
 * @param {readonly string[]} candidates Non-empty.
 * @param {import('./rng.js').Rng} rng
 * @returns {string}
 */
export function randomCandidate(candidates, rng) {
  return candidates[randomInt(rng, candidates.length)];
}

/**
 * Hard strategy (Knuth-style minimax): the guess whose largest group of
 * candidates sharing one answer is smallest. Ties prefer guesses that could
 * still be the secret, then the lowest code, so the choice is deterministic.
 * @param {Config} config
 * @param {readonly string[]} candidates Codes consistent with all answers (non-empty).
 * @param {readonly string[]} guessed Guesses made so far.
 * @returns {string}
 */
export function minimaxGuess(config, candidates, guessed) {
  const table = codeTable(config);
  const cands = Int32Array.from(candidates, (code) => table.index.get(code));
  // With one or two candidates the lowest candidate already wins every tie-break.
  if (cands.length <= 2) return table.codes[Math.min(...cands)];

  const isCandidate = new Uint8Array(table.codes.length);
  for (const c of cands) isCandidate[c] = 1;
  const counts = new Int32Array(ANSWER_SLOTS);
  let best = -1;
  let bestWorst = Infinity;
  let bestIsCandidate = false;
  for (const g of guessPool(table, config, guessed)) {
    const consistent = isCandidate[g] === 1;
    const limit = consistent && !bestIsCandidate ? bestWorst : bestWorst - 1;
    const worst = largestGroup(table, g, cands, counts, limit);
    if (worst <= limit) {
      best = g;
      bestWorst = worst;
      bestIsCandidate = consistent;
    }
  }
  return table.codes[best];
}

/*
 * Fast scoring for the minimax search. Each code is packed into an integer
 * with one 4-bit nibble per position plus a 10-bit mask of its digits:
 *   bulls  = positions whose nibbles are equal,
 *   common = bits shared by both masks, cows = common - bulls.
 */

/** Answer slots: bulls * 6 + cows covers every answer up to 5 digits. */
const ANSWER_SLOTS = 36;
/** The lowest bit of each of the five nibbles. */
const NIBBLE_LOW_BITS = 0x11111;
/** Number of set bits for every 10-bit digit mask. */
const POPCOUNT = Uint8Array.from({ length: 1024 }, (_, mask) => countBits(mask));

/**
 * @param {number} mask
 * @returns {number}
 */
function countBits(mask) {
  let count = 0;
  for (let m = mask; m !== 0; m &= m - 1) count++;
  return count;
}

/**
 * @typedef {object} CodeTable
 * @property {number} digits
 * @property {readonly string[]} codes
 * @property {Map<string, number>} index Code to its position in `codes`.
 * @property {Int32Array} packed One nibble per position, first digit lowest.
 * @property {Int32Array} masks Bit d set when the code uses digit d.
 */

/** @type {Map<string, CodeTable>} */
const tableCache = new Map();

/**
 * The packed code table for a config (built once, then cached).
 * @param {Config} config
 * @returns {CodeTable}
 */
function codeTable(config) {
  const key = `${config.digits}:${config.leadingZero}`;
  let table = tableCache.get(key);
  if (!table) {
    table = buildTable(config.digits, allCodes(config));
    tableCache.set(key, table);
  }
  return table;
}

/**
 * @param {number} digits
 * @param {readonly string[]} codes
 * @returns {CodeTable}
 */
function buildTable(digits, codes) {
  const packed = new Int32Array(codes.length);
  const masks = new Int32Array(codes.length);
  const index = new Map();
  codes.forEach((code, i) => {
    for (let k = 0; k < code.length; k++) {
      const d = code.charCodeAt(k) - 48;
      packed[i] |= d << (4 * k);
      masks[i] |= 1 << d;
    }
    index.set(code, i);
  });
  return { digits, codes, index, packed, masks };
}

/**
 * Guesses worth scoring. Digits that were never guessed are interchangeable
 * (except 0 when codes cannot start with it): renaming them maps the
 * candidates onto themselves, so guesses that differ only by such a renaming
 * split the candidates identically. Only the lowest guess of each such
 * family is kept - the one using the interchangeable digits in ascending
 * order - which leaves the minimax choice unchanged.
 * @param {CodeTable} table
 * @param {Config} config
 * @param {readonly string[]} guessed
 * @returns {number[]} Indices into the table, ascending.
 */
function guessPool(table, config, guessed) {
  const used = new Set(guessed.join(''));
  const fresh = [];
  for (let d = 0; d <= 9; d++) {
    if (!used.has(String(d)) && (config.leadingZero || d !== 0)) fresh.push(d);
  }
  const freshMask = fresh.reduce((mask, d) => mask | (1 << d), 0);
  const pool = [];
  for (let i = 0; i < table.codes.length; i++) {
    if (usesFreshInOrder(table.packed[i], table.digits, fresh, freshMask)) pool.push(i);
  }
  return pool;
}

/**
 * Whether the interchangeable digits of a packed code are exactly the first
 * few of `fresh`, in ascending order from left to right.
 * @param {number} packed
 * @param {number} digits Code length.
 * @param {readonly number[]} fresh Interchangeable digits, ascending.
 * @param {number} freshMask The same digits as a bit mask.
 * @returns {boolean}
 */
function usesFreshInOrder(packed, digits, fresh, freshMask) {
  let next = 0;
  for (let k = 0; k < digits; k++) {
    const d = (packed >>> (4 * k)) & 15;
    if ((freshMask >>> d) & 1) {
      if (d !== fresh[next]) return false;
      next++;
    }
  }
  return true;
}

/**
 * Size of the largest group of candidates that would give `guess` the same
 * answer. Stops early once the size exceeds `limit`.
 * @param {CodeTable} table
 * @param {number} guess Index of the guess.
 * @param {Int32Array} cands Candidate indices.
 * @param {Int32Array} counts Scratch array with ANSWER_SLOTS entries.
 * @param {number} limit
 * @returns {number}
 */
function largestGroup(table, guess, cands, counts, limit) {
  const { packed, masks, digits } = table;
  const guessPacked = packed[guess];
  const guessMask = masks[guess];
  counts.fill(0);
  let worst = 0;
  for (let k = 0; k < cands.length; k++) {
    const c = cands[k];
    const x = guessPacked ^ packed[c];
    const differing = (x | (x >>> 1) | (x >>> 2) | (x >>> 3)) & NIBBLE_LOW_BITS;
    const bulls = digits - ((Math.imul(differing, NIBBLE_LOW_BITS) >>> 16) & 15);
    const cows = POPCOUNT[guessMask & masks[c]] - bulls;
    const size = ++counts[bulls * 6 + cows];
    if (size > worst) {
      worst = size;
      if (worst > limit) break;
    }
  }
  return worst;
}
