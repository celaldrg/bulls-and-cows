import test from 'node:test';
import assert from 'node:assert/strict';
import { allCodes, isPossibleAnswer, score } from '../src/codes.js';
import { createRng, randomInt } from '../src/rng.js';
import {
  consistentCodes,
  filterCandidates,
  findConflict,
  minimaxGuess,
  randomCandidate,
} from '../src/solver.js';
import { createSolverGame } from '../src/game.js';

const FOUR = Object.freeze({ digits: 4, leadingZero: true });

/** Groups candidates by the answer they would give to `guess`. */
function splitByAnswer(candidates, guess) {
  const groups = new Map();
  for (const code of candidates) {
    const { bulls, cows } = score(code, guess);
    const key = `${bulls}/${cows}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(code);
  }
  return groups;
}

/**
 * Walks the hard solver's whole decision tree (one branch per possible
 * answer sequence) and returns secret -> number of guesses needed,
 * the winning guess included.
 */
function solveAll(config) {
  const guessesFor = new Map();
  const walk = (candidates, guessed) => {
    assert.ok(guessed.length < 12, 'the solver stopped making progress');
    const guess = minimaxGuess(config, candidates, guessed);
    for (const [key, group] of splitByAnswer(candidates, guess)) {
      if (key === `${config.digits}/0`) guessesFor.set(guess, guessed.length + 1);
      else walk(group, [...guessed, guess]);
    }
  };
  walk(allCodes(config), []);
  return guessesFor;
}

function summarizeTree(guessesFor) {
  const counts = [...guessesFor.values()];
  const total = counts.reduce((sum, n) => sum + n, 0);
  const max = counts.reduce((m, n) => Math.max(m, n), 0);
  return { solved: counts.length, max, total, average: total / counts.length };
}

function describe({ solved, max, total, average }) {
  return `solved ${solved}, max ${max} guesses, average ${average.toFixed(4)} (${total} guesses)`;
}

let fourTree;
const getFourTree = () => (fourTree ??= solveAll(FOUR));

/** Plays a solver game, answering every guess truthfully for `secret`. */
function playHonestly(options, secret) {
  const game = createSolverGame(options);
  for (let turn = 0; turn < 15 && game.getState().status === 'playing'; turn++) {
    const { bulls, cows } = score(secret, game.getState().pending);
    const result = game.answer(bulls, cows);
    assert.ok(result.ok, `answer refused while solving ${secret}`);
  }
  return game.getState();
}

/** Brute-force Knuth minimax over every code with plain string scoring. */
function referenceMinimax(config, candidates) {
  const isCandidate = new Set(candidates);
  let best = null;
  let bestWorst = Infinity;
  let bestIsCandidate = false;
  for (const guess of allCodes(config)) {
    const worst = Math.max(...[...splitByAnswer(candidates, guess).values()].map((g) => g.length));
    const consistent = isCandidate.has(guess);
    if (worst < bestWorst || (worst === bestWorst && consistent && !bestIsCandidate)) {
      best = guess;
      bestWorst = worst;
      bestIsCandidate = consistent;
    }
  }
  return best;
}

/** The (candidates, guessed) positions met while the hard solver cracks `secret`. */
function positionsFor(config, secret) {
  const positions = [];
  let candidates = allCodes(config);
  const guessed = [];
  for (;;) {
    positions.push({ candidates, guessed: [...guessed] });
    const guess = minimaxGuess(config, candidates, guessed);
    const answer = { guess, ...score(secret, guess) };
    if (answer.bulls === config.digits) return positions;
    candidates = filterCandidates(candidates, answer);
    guessed.push(guess);
  }
}

test('DONE: the minimax solver cracks all 5040 four-digit secrets in at most 7 guesses, average under 5.6', (t) => {
  const tree = getFourTree();
  const stats = summarizeTree(tree);
  const numbers = describe(stats);
  t.diagnostic(`4 digits, leading zero allowed: ${numbers}`);
  assert.equal(stats.solved, 5040, numbers);
  assert.deepEqual([...tree.keys()].sort(), [...allCodes(FOUR)], `every secret exactly once: ${numbers}`);
  assert.ok(stats.max <= 7, `at most 7 guesses expected: ${numbers}`);
  assert.ok(stats.average < 5.6, `average under 5.6 expected: ${numbers}`);
});

test('the minimax solver is deterministic', () => {
  assert.deepEqual(solveAll(FOUR), getFourTree());
  assert.equal(minimaxGuess(FOUR, allCodes(FOUR), []), '0123');
});

test('real solver games match the decision tree (all 7-guess secrets plus a sample)', () => {
  const sample = [...getFourTree()].filter(([, guesses], i) => guesses === 7 || i % 97 === 0);
  assert.ok(sample.length > 200);
  for (const [secret, expected] of sample) {
    const state = playHonestly({ ...FOUR, level: 'hard', seed: 1 }, secret);
    assert.equal(state.status, 'won', secret);
    assert.equal(state.history.at(-1).guess, secret);
    assert.equal(state.guesses, expected, `guesses for ${secret}`);
  }
});

test('minimax matches a brute-force reference at every node of both 3-digit trees', () => {
  for (const leadingZero of [true, false]) {
    const config = { digits: 3, leadingZero };
    let nodes = 0;
    const walk = (candidates, guessed) => {
      const guess = minimaxGuess(config, candidates, guessed);
      assert.equal(guess, referenceMinimax(config, candidates), `after ${guessed.join(',')}`);
      nodes++;
      for (const [key, group] of splitByAnswer(candidates, guess)) {
        if (key !== '3/0') walk(group, [...guessed, guess]);
      }
    };
    walk(allCodes(config), []);
    assert.ok(nodes > 500, `walked ${nodes} nodes`);
  }
});

test('minimax matches the brute-force reference on 4- and 5-digit positions', () => {
  const cases = [
    [FOUR, '9876'],
    [{ digits: 4, leadingZero: false }, '5031'],
    [{ digits: 5, leadingZero: true }, '97531'],
    [{ digits: 5, leadingZero: false }, '80642'],
  ];
  let checked = 0;
  for (const [config, secret] of cases) {
    const limit = config.digits === 5 ? 40 : 150;
    for (const { candidates, guessed } of positionsFor(config, secret)) {
      if (candidates.length < 3 || candidates.length > limit) continue;
      assert.equal(minimaxGuess(config, candidates, guessed), referenceMinimax(config, candidates));
      checked++;
    }
  }
  assert.ok(checked >= 4, `checked ${checked} positions`);
});

test('3-digit variants: every secret is cracked', (t) => {
  for (const [leadingZero, count] of [[true, 720], [false, 648]]) {
    const stats = summarizeTree(solveAll({ digits: 3, leadingZero }));
    t.diagnostic(`3 digits, leading zero ${leadingZero}: ${describe(stats)}`);
    assert.equal(stats.solved, count, describe(stats));
    assert.ok(stats.max <= 7, describe(stats));
  }
});

test('4 digits without a leading zero: all 4536 secrets in at most 7 guesses', (t) => {
  const stats = summarizeTree(solveAll({ digits: 4, leadingZero: false }));
  t.diagnostic(`4 digits, no leading zero: ${describe(stats)}`);
  assert.equal(stats.solved, 4536, describe(stats));
  assert.ok(stats.max <= 7, describe(stats));
  assert.ok(stats.average < 5.6, describe(stats));
});

test('5-digit variants: sampled secrets are cracked in at most 8 guesses', () => {
  const rng = createRng(2026);
  for (const leadingZero of [true, false]) {
    const config = { digits: 5, leadingZero };
    const codes = allCodes(config);
    for (let i = 0; i < 2; i++) {
      const secret = codes[randomInt(rng, codes.length)];
      const state = playHonestly({ ...config, level: 'hard', seed: i }, secret);
      assert.equal(state.status, 'won', secret);
      assert.equal(state.history.at(-1).guess, secret);
      assert.ok(state.guesses <= 8, `${secret} took ${state.guesses} guesses`);
    }
  }
});

test('easy solver picks random consistent candidates, deterministically per seed', () => {
  const rng = createRng(99);
  const codes = allCodes(FOUR);
  for (let i = 0; i < 25; i++) {
    const secret = codes[randomInt(rng, codes.length)];
    const game = createSolverGame({ ...FOUR, level: 'easy', seed: i });
    while (game.getState().status === 'playing') {
      const { pending, history } = game.getState();
      assert.ok(consistentCodes(FOUR, history).includes(pending), 'easy guesses stay consistent');
      const { bulls, cows } = score(secret, pending);
      assert.ok(game.answer(bulls, cows).ok);
      assert.ok(game.getState().guesses <= 10, `easy game for ${secret} runs too long`);
    }
    const replay = playHonestly({ ...FOUR, level: 'easy', seed: i }, secret);
    assert.deepEqual(replay.history, game.getState().history, 'same seed, same game');
  }
});

test('randomCandidate draws from the list with the seeded RNG', () => {
  const list = ['012', '345', '678'];
  const a = createRng(5);
  const b = createRng(5);
  const drawn = Array.from({ length: 30 }, () => randomCandidate(list, a));
  assert.deepEqual(Array.from({ length: 30 }, () => randomCandidate(list, b)), drawn);
  assert.deepEqual([...new Set(drawn)].sort(), list);
});

test('filterCandidates and consistentCodes keep exactly the fitting codes', () => {
  const answer = { guess: '0123', bulls: 0, cows: 4 };
  const deranged = filterCandidates(allCodes(FOUR), answer);
  assert.equal(deranged.length, 9);
  assert.ok(deranged.every((code) => code.split('').sort().join('') === '0123'));
  assert.deepEqual(consistentCodes(FOUR, [answer]), deranged);
  assert.equal(consistentCodes(FOUR, []).length, 5040);
});

test('findConflict: null while the answers still fit some code', () => {
  const history = [{ guess: '0123', bulls: 1, cows: 1 }];
  assert.equal(findConflict(FOUR, history, { guess: '4567', bulls: 0, cows: 1 }), null);
});

test('findConflict: names a minimal set of clashing earlier answers', () => {
  const history = [
    { guess: '0123', bulls: 0, cows: 1 }, // one of 0-3, so three of 4-9
    { guess: '9876', bulls: 0, cows: 2 }, // consistent, but not part of the clash
    { guess: '4567', bulls: 0, cows: 1 }, // one of 4-7, so both 8 and 9
  ];
  assert.ok(consistentCodes(FOUR, history).length > 0);
  const answer = { guess: '8945', bulls: 0, cows: 1 }; // only one of 8, 9, 4, 5: impossible
  assert.deepEqual(findConflict(FOUR, history, answer), [0, 2]);
  assert.deepEqual(findConflict(FOUR, [], { guess: '0123', bulls: 3, cows: 1 }), []);
});

test('inconsistent answers are detected and explained (seeded random liar)', () => {
  let contradictions = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const rng = createRng(seed);
    const game = createSolverGame({ ...FOUR, level: 'hard', seed });
    for (let turn = 0; turn < 10 && game.getState().status === 'playing'; turn++) {
      const before = game.getState();
      const bulls = randomInt(rng, 3);
      const cows = randomInt(rng, 5 - bulls);
      assert.ok(isPossibleAnswer(bulls, cows, 4));
      const answer = { guess: before.pending, bulls, cows };
      const fitting = consistentCodes(FOUR, [...before.history, answer]);
      const result = game.answer(bulls, cows);
      const after = game.getState();
      if (fitting.length > 0) {
        assert.equal(result.ok, true);
        assert.equal(after.remaining, fitting.length);
        continue;
      }
      contradictions++;
      assert.equal(result.error, 'contradiction');
      assert.ok(result.entries.length > 0, 'a refused answer always names an earlier answer');
      assert.deepEqual(after.conflict, { bulls, cows, entries: result.entries });
      assert.deepEqual(after.history, before.history, 'a refused answer is not recorded');
      assert.equal(after.pending, before.pending);
      const clash = (entries) => entries.map((i) => before.history[i]);
      assert.equal(consistentCodes(FOUR, [...clash(result.entries), answer]).length, 0);
      for (const dropped of result.entries) {
        const rest = result.entries.filter((i) => i !== dropped);
        assert.ok(consistentCodes(FOUR, [...clash(rest), answer]).length > 0, 'conflict is minimal');
      }
    }
  }
  assert.ok(contradictions >= 5, `only ${contradictions} contradictions exercised`);
});
