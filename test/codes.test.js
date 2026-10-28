import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  DIGIT_OPTIONS,
  allCodes,
  appendDigitError,
  canAppendDigit,
  isPossibleAnswer,
  normalizeConfig,
  randomCode,
  score,
  stepAnswer,
  validateCode,
} from '../src/codes.js';
import { createRng, randomInt, randomSeed } from '../src/rng.js';

test('score: known pairs for secret 1234', () => {
  assert.deepEqual(score('1234', '1243'), { bulls: 2, cows: 2 });
  assert.deepEqual(score('1234', '5678'), { bulls: 0, cows: 0 });
  assert.deepEqual(score('1234', '4321'), { bulls: 0, cows: 4 });
  assert.deepEqual(score('1234', '1234'), { bulls: 4, cows: 0 });
  assert.deepEqual(score('1234', '1567'), { bulls: 1, cows: 0 });
  assert.deepEqual(score('1234', '5167'), { bulls: 0, cows: 1 });
});

test('score: 3- and 5-digit codes', () => {
  assert.deepEqual(score('012', '210'), { bulls: 1, cows: 2 });
  assert.deepEqual(score('012', '345'), { bulls: 0, cows: 0 });
  assert.deepEqual(score('01234', '43210'), { bulls: 1, cows: 4 });
  assert.deepEqual(score('98765', '98756'), { bulls: 3, cows: 2 });
});

test('score is symmetric and bulls + cows equals the shared digits', () => {
  const rng = createRng(11);
  for (const digits of DIGIT_OPTIONS) {
    const config = { digits, leadingZero: true };
    for (let i = 0; i < 300; i++) {
      const a = randomCode(config, rng);
      const b = randomCode(config, rng);
      const ab = score(a, b);
      assert.deepEqual(score(b, a), ab);
      assert.equal(ab.bulls + ab.cows, [...a].filter((d) => b.includes(d)).length);
    }
  }
});

test('there are 5040 codes of 4 distinct digits when a leading zero is allowed', () => {
  assert.equal(allCodes({ digits: 4, leadingZero: true }).length, 5040);
});

test('code counts for every setting', () => {
  const expected = [
    [3, true, 720],
    [3, false, 648],
    [4, true, 5040],
    [4, false, 4536],
    [5, true, 30240],
    [5, false, 27216],
  ];
  for (const [digits, leadingZero, count] of expected) {
    const codes = allCodes({ digits, leadingZero });
    assert.equal(codes.length, count, `${digits} digits, leading zero ${leadingZero}`);
    assert.equal(new Set(codes).size, count, 'no duplicates');
    assert.ok(codes.every((code) => validateCode(code, { digits, leadingZero }) === null));
    assert.deepEqual([...codes], [...codes].sort(), 'ascending order');
  }
});

test('allCodes is cached and frozen', () => {
  const codes = allCodes({ digits: 3, leadingZero: true });
  assert.equal(allCodes({ digits: 3, leadingZero: true }), codes);
  assert.ok(Object.isFrozen(codes));
});

test('normalizeConfig keeps valid settings and repairs invalid ones', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(DEFAULT_CONFIG, { digits: 4, leadingZero: true });
  assert.deepEqual(normalizeConfig({ digits: 5, leadingZero: false }), { digits: 5, leadingZero: false });
  assert.deepEqual(normalizeConfig({ digits: 6, leadingZero: 'no' }), { digits: 4, leadingZero: true });
  assert.deepEqual(normalizeConfig({ digits: '3' }), { digits: 4, leadingZero: true });
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG, 'stored "null" must not crash');
  assert.deepEqual(normalizeConfig('5'), DEFAULT_CONFIG);
});

test('validateCode reports the first problem', () => {
  const config = { digits: 4, leadingZero: false };
  assert.equal(validateCode('1234', config), null);
  assert.equal(validateCode('123', config), 'length');
  assert.equal(validateCode(1234, config), 'length');
  assert.equal(validateCode('12 4', config), 'digits');
  assert.equal(validateCode('1224', config), 'distinct');
  assert.equal(validateCode('0123', config), 'leadingZero');
  assert.equal(validateCode('0123', { digits: 4, leadingZero: true }), null);
});

test('canAppendDigit blocks repeats, overflow and a forbidden leading zero', () => {
  const noZero = { digits: 3, leadingZero: false };
  assert.equal(canAppendDigit('', 0, noZero), false);
  assert.equal(canAppendDigit('', 0, { digits: 3, leadingZero: true }), true);
  assert.equal(canAppendDigit('1', 0, noZero), true);
  assert.equal(canAppendDigit('12', 2, noZero), false);
  assert.equal(canAppendDigit('12', 3, noZero), true);
  assert.equal(canAppendDigit('123', 4, noZero), false);
});

test('appendDigitError names the reason a digit is refused', () => {
  const noZero = { digits: 3, leadingZero: false };
  assert.equal(appendDigitError('', 0, noZero), 'leadingZero');
  assert.equal(appendDigitError('', 0, { digits: 3, leadingZero: true }), null);
  assert.equal(appendDigitError('1', 0, noZero), null, 'a zero later on is fine');
  assert.equal(appendDigitError('12', 2, noZero), 'distinct');
  assert.equal(appendDigitError('123', 4, noZero), 'full');
  assert.equal(appendDigitError('123', 3, noZero), 'full', 'full wins over a repeat');
});

test('canAppendDigit agrees with appendDigitError for every partial code', () => {
  for (const config of [{ digits: 3, leadingZero: false }, { digits: 5, leadingZero: true }]) {
    for (const partial of ['', '7', '70', '702', '7024', '70245']) {
      for (let digit = 0; digit <= 9; digit++) {
        const allowed = canAppendDigit(partial, digit, config);
        assert.equal(allowed, appendDigitError(partial, digit, config) === null, `${partial}+${digit}`);
        if (allowed) assert.equal(validateCode(partial + digit, { ...config, digits: partial.length + 1 }), null);
      }
    }
  }
});

test('stepAnswer keeps bulls and cows non-negative and within the code length', () => {
  const zero = { bulls: 0, cows: 0 };
  assert.deepEqual(stepAnswer(zero, 'bulls', 1, 4), { bulls: 1, cows: 0 });
  assert.deepEqual(stepAnswer(zero, 'cows', -1, 4), zero, 'never below zero');
  assert.deepEqual(stepAnswer({ bulls: 2, cows: 2 }, 'cows', 1, 4), { bulls: 2, cows: 2 }, 'never above the length');
  assert.deepEqual(stepAnswer({ bulls: 2, cows: 2 }, 'bulls', -1, 4), { bulls: 1, cows: 2 });
  assert.deepEqual(stepAnswer({ bulls: 3, cows: 0 }, 'cows', 1, 4), { bulls: 3, cows: 1 }, 'impossible answers can be stepped through');
  assert.deepEqual(stepAnswer({ bulls: 5, cows: 0 }, 'bulls', 1, 5), { bulls: 5, cows: 0 });
  assert.deepEqual(stepAnswer(zero, 'other', 1, 4), zero, 'unknown fields change nothing');
  const start = { bulls: 1, cows: 1 };
  stepAnswer(start, 'bulls', 1, 4);
  assert.deepEqual(start, { bulls: 1, cows: 1 }, 'the input is not changed');
});

/**
 * One guess of each kind. Renaming digits keeps every score, so all guesses
 * of one length behave alike, except that 0 must stay 0 when codes cannot
 * start with it: then guesses differ only in where 0 sits, or whether it is used.
 * @param {{digits: number, leadingZero: boolean}} config
 * @returns {string[]}
 */
function guessKinds(config) {
  const kinds = new Map();
  for (const code of allCodes(config)) {
    const kind = config.leadingZero ? 0 : code.indexOf('0');
    if (!kinds.has(kind)) kinds.set(kind, code);
  }
  return [...kinds.values()];
}

// The solver view relies on this: an answer that gets past isPossibleAnswer
// is never impossible on its own, so a refused answer always clashes with
// earlier ones (game.answer reports at least one of them).
test('isPossibleAnswer matches exactly the answers that scoring can produce', () => {
  for (const digits of DIGIT_OPTIONS) {
    const allowed = new Set();
    for (let bulls = 0; bulls <= digits; bulls++) {
      for (let cows = 0; cows <= digits; cows++) {
        if (isPossibleAnswer(bulls, cows, digits)) allowed.add(JSON.stringify({ bulls, cows }));
      }
    }
    for (const leadingZero of [true, false]) {
      const config = { digits, leadingZero };
      const kinds = guessKinds(config);
      assert.equal(kinds.length, leadingZero ? 1 : digits, 'one kind, or one per place of 0 plus one without 0');
      for (const guess of kinds) {
        const produced = new Set(allCodes(config).map((secret) => JSON.stringify(score(secret, guess))));
        assert.deepEqual(produced, allowed, `${digits} digits, leading zero ${leadingZero}, guess ${guess}`);
      }
    }
  }
  assert.equal(isPossibleAnswer(3, 1, 4), false);
  assert.equal(isPossibleAnswer(2, 3, 4), false);
  assert.equal(isPossibleAnswer(-1, 0, 4), false);
  assert.equal(isPossibleAnswer(0.5, 0, 4), false);
  assert.equal(isPossibleAnswer(4, 0, 4), true);
});

test('randomCode is deterministic for a seed and covers the code space', () => {
  const config = { digits: 3, leadingZero: false };
  const draw = (seed) => {
    const rng = createRng(seed);
    return Array.from({ length: 400 }, () => randomCode(config, rng));
  };
  const codes = draw(8);
  assert.deepEqual(draw(8), codes);
  assert.notDeepEqual(draw(9), codes);
  assert.ok(codes.every((code) => validateCode(code, config) === null));
  assert.ok(new Set(codes).size > 200);
});

test('rng: same seed, same sequence; values in [0, 1); randomInt in range', () => {
  const a = createRng(123);
  const b = createRng(123);
  const values = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(Array.from({ length: 1000 }, () => b()), values);
  assert.ok(values.every((v) => v >= 0 && v < 1));
  assert.ok(new Set(values).size > 990);
  const rng = createRng(4);
  const ints = Array.from({ length: 1000 }, () => randomInt(rng, 6));
  assert.ok(ints.every((n) => Number.isInteger(n) && n >= 0 && n < 6));
  assert.equal(new Set(ints).size, 6);
});

test('randomSeed gives a 32-bit unsigned integer', () => {
  for (let i = 0; i < 50; i++) {
    const seed = randomSeed();
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32, String(seed));
  }
});
