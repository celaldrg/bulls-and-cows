/**
 * Small seeded random number generator (mulberry32) so every game and test
 * can be replayed exactly from a 32-bit seed.
 */

/**
 * @typedef {() => number} Rng A function returning floats in [0, 1).
 */

/**
 * Creates a deterministic generator from a seed.
 * @param {number} seed Any number; only its low 32 bits are used.
 * @returns {Rng}
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks an integer in [0, n).
 * @param {Rng} rng
 * @param {number} n Exclusive upper bound, at least 1.
 * @returns {number}
 */
export function randomInt(rng, n) {
  return Math.floor(rng() * n);
}

/**
 * A fresh, unpredictable seed for normal play (tests pass fixed seeds instead).
 * @returns {number}
 */
export function randomSeed() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
