import test from 'node:test';
import assert from 'node:assert/strict';
import { allCodes, isPossibleAnswer, score } from '../src/codes.js';
import { consistentCodes, filterCandidates, minimaxGuess } from '../src/solver.js';
import {
  MODES,
  NOTE_MARKS,
  createDemoGame,
  createGame,
  createGuessingGame,
  createSolverGame,
} from '../src/game.js';

const FOUR = Object.freeze({ digits: 4, leadingZero: true });
const PROBES = ['0123', '4567', '8901', '2345', '6789', '1357'];

const feedback = (game) => PROBES.map((code) => game.guess(code));

test('createGame starts a 4-digit guessing game by default', () => {
  const state = createGame({ seed: 1 }).getState();
  assert.deepEqual(MODES, ['guess', 'solve']);
  assert.equal(state.mode, 'guess');
  assert.equal(state.digits, 4);
  assert.equal(state.leadingZero, true);
  assert.equal(state.status, 'playing');
  assert.deepEqual(state.history, []);
  assert.deepEqual(state.notes, Array(10).fill('none'));
  assert.equal(state.guesses, 0);
  assert.equal(state.secret, null, 'the secret stays hidden while playing');
});

test('the secret comes from the seeded RNG', () => {
  assert.deepEqual(feedback(createGame({ seed: 42 })), feedback(createGame({ seed: 42 })));
  const differs = [43, 44, 45].some(
    (seed) => JSON.stringify(feedback(createGame({ seed }))) !== JSON.stringify(feedback(createGame({ seed: 42 }))),
  );
  assert.ok(differs, 'other seeds give other secrets');
});

test('a seeded guessing game can be won and then refuses more guesses', () => {
  const game = createGuessingGame({ ...FOUR, seed: 7 });
  let candidates = allCodes(FOUR);
  let result;
  do {
    const guess = minimaxGuess(FOUR, candidates, game.getState().history.map((e) => e.guess));
    result = game.guess(guess);
    assert.equal(result.ok, true);
    candidates = filterCandidates(candidates, { guess, bulls: result.bulls, cows: result.cows });
  } while (!result.won);
  const state = game.getState();
  assert.equal(state.status, 'won');
  assert.ok(state.guesses <= 7);
  assert.equal(state.secret, state.history.at(-1).guess);
  assert.deepEqual(state.history.at(-1), { guess: state.secret, bulls: 4, cows: 0 });
  assert.deepEqual(game.guess('0123'), { ok: false, error: 'over' });
});

test('guesses report bulls and cows', () => {
  const game = createGuessingGame({ ...FOUR, secret: '1234' });
  assert.deepEqual(game.guess('1243'), { ok: true, bulls: 2, cows: 2, won: false });
  assert.deepEqual(game.guess('5678'), { ok: true, bulls: 0, cows: 0, won: false });
  assert.deepEqual(game.guess('4321'), { ok: true, bulls: 0, cows: 4, won: false });
  assert.deepEqual(game.guess('1234'), { ok: true, bulls: 4, cows: 0, won: true });
  assert.equal(game.getState().guesses, 4);
});

test('invalid guesses are refused and not recorded', () => {
  const game = createGuessingGame({ digits: 4, leadingZero: false, secret: '1234' });
  assert.deepEqual(game.guess('123'), { ok: false, error: 'length' });
  assert.deepEqual(game.guess('12a4'), { ok: false, error: 'digits' });
  assert.deepEqual(game.guess('1123'), { ok: false, error: 'distinct' });
  assert.deepEqual(game.guess('0123'), { ok: false, error: 'leadingZero' });
  assert.equal(game.guess('5678').ok, true);
  assert.deepEqual(game.guess('5678'), { ok: false, error: 'repeated' });
  assert.equal(game.getState().history.length, 1);
});

test('a fixed secret must be valid for the settings', () => {
  assert.throws(() => createGuessingGame({ ...FOUR, secret: '1123' }), RangeError);
  assert.throws(() => createGuessingGame({ digits: 3, leadingZero: false, secret: '012' }), RangeError);
});

test('notes cycle none -> excluded -> confirmed -> none', () => {
  const game = createGuessingGame({ ...FOUR, seed: 3 });
  assert.deepEqual(NOTE_MARKS, ['none', 'excluded', 'confirmed']);
  assert.equal(game.cycleNote(7), 'excluded');
  assert.equal(game.cycleNote(7), 'confirmed');
  assert.equal(game.cycleNote(0), 'excluded');
  assert.deepEqual(game.getState().notes, [
    'excluded', 'none', 'none', 'none', 'none', 'none', 'none', 'confirmed', 'none', 'none',
  ]);
  assert.equal(game.cycleNote(7), 'none');
  assert.throws(() => game.cycleNote(10), RangeError);
  assert.throws(() => game.cycleNote(-1), RangeError);
  assert.throws(() => game.cycleNote(1.5), RangeError);
});

test('getState returns a snapshot that cannot change the game', () => {
  const game = createGuessingGame({ ...FOUR, secret: '1234' });
  game.guess('5678');
  const state = game.getState();
  state.history[0].bulls = 4;
  state.history.push({ guess: '1234', bulls: 4, cows: 0 });
  state.notes[0] = 'confirmed';
  assert.deepEqual(game.getState().history, [{ guess: '5678', bulls: 0, cows: 0 }]);
  assert.equal(game.getState().notes[0], 'none');
});

test('3- and 5-digit guessing games use codes of that length', () => {
  for (const digits of [3, 5]) {
    for (const leadingZero of [true, false]) {
      const config = { digits, leadingZero };
      const game = createGuessingGame({ ...config, seed: digits * 10 });
      const guess = allCodes(config)[0];
      const result = game.guess(guess);
      assert.equal(result.ok, true);
      assert.ok(isPossibleAnswer(result.bulls, result.cows, digits));
      assert.equal(game.guess(guess.slice(1)).error, 'length');
      assert.equal(game.getState().digits, digits);
    }
  }
});

test('settings are normalized: unknown values fall back to defaults', () => {
  const state = createGame({ digits: 9, leadingZero: 'yes', seed: 1 }).getState();
  assert.equal(state.digits, 4);
  assert.equal(state.leadingZero, true);
  const solver = createGame({ mode: 'solve', level: 'genius', seed: 1 }).getState();
  assert.equal(solver.mode, 'solve');
  assert.equal(solver.level, 'hard');
});

test('solver game: the computer cracks a secret from honest answers', () => {
  const game = createSolverGame({ ...FOUR, level: 'hard', seed: 1 });
  const start = game.getState();
  assert.equal(start.pending, '0123', 'all first guesses are equal; the lowest wins');
  assert.equal(start.remaining, 5040);
  assert.equal(start.conflict, null);
  const secret = '7295';
  let previous = start.remaining;
  while (game.getState().status === 'playing') {
    const { bulls, cows } = score(secret, game.getState().pending);
    assert.equal(game.answer(bulls, cows).ok, true);
    const { remaining } = game.getState();
    assert.ok(remaining < previous, 'every answer narrows the candidates');
    previous = remaining;
  }
  const end = game.getState();
  assert.equal(end.status, 'won');
  assert.equal(end.pending, null);
  assert.equal(end.remaining, 1);
  assert.ok(end.guesses <= 7);
  assert.deepEqual(end.history.at(-1), { guess: secret, bulls: 4, cows: 0 });
  assert.deepEqual(game.answer(4, 0), { ok: false, error: 'over' });
});

test('solver game refuses answers that no guess could get', () => {
  const game = createSolverGame({ ...FOUR, seed: 1 });
  for (const [bulls, cows] of [[3, 1], [5, 0], [2, 3], [-1, 0], [1.5, 0], [Number.NaN, 0]]) {
    assert.deepEqual(game.answer(bulls, cows), { ok: false, error: 'invalid' }, `${bulls}/${cows}`);
  }
  assert.equal(game.getState().history.length, 0);
});

test('solver game: a contradiction is refused, explained and can be fixed', () => {
  const game = createSolverGame({ ...FOUR, level: 'hard', seed: 1 });
  assert.equal(game.answer(0, 0).ok, true); // 0123: none of 0-3
  const before = game.getState();
  const contradictory = [];
  for (let bulls = 0; bulls <= 4; bulls++) {
    for (let cows = 0; bulls + cows <= 4; cows++) {
      const answer = { guess: before.pending, bulls, cows };
      if (isPossibleAnswer(bulls, cows, 4) && consistentCodes(FOUR, [...before.history, answer]).length === 0) {
        contradictory.push([bulls, cows]);
      }
    }
  }
  assert.ok(contradictory.length > 0);
  const [bulls, cows] = contradictory[0];
  const result = game.answer(bulls, cows);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'contradiction');
  const refused = game.getState();
  assert.deepEqual(refused.conflict, { bulls, cows, entries: result.entries });
  assert.deepEqual(refused.history, before.history);
  assert.equal(refused.pending, before.pending);
  assert.equal(refused.remaining, before.remaining);

  const honest = score('4567', before.pending);
  assert.equal(game.answer(honest.bulls, honest.cows).ok, true);
  assert.equal(game.getState().conflict, null, 'a valid answer clears the conflict');
});

test('solver game: undo takes back answers one by one', () => {
  const game = createSolverGame({ ...FOUR, level: 'hard', seed: 1 });
  const answerFor = (secret) => {
    const { bulls, cows } = score(secret, game.getState().pending);
    assert.equal(game.answer(bulls, cows).ok, true);
  };
  assert.equal(game.undo(), false, 'nothing to undo yet');
  const first = game.getState();
  answerFor('5130');
  const second = game.getState();
  answerFor('5130');
  assert.equal(game.getState().history.length, 2);

  assert.equal(game.undo(), true);
  assert.deepEqual(game.getState(), second);
  assert.equal(game.undo(), true);
  assert.deepEqual(game.getState(), first);
  assert.equal(game.undo(), false);
});

test('solver game: undo after a win resumes play', () => {
  const game = createSolverGame({ ...FOUR, level: 'hard', seed: 1 });
  game.answer(4, 0);
  assert.equal(game.getState().status, 'won');
  assert.equal(game.undo(), true);
  const state = game.getState();
  assert.equal(state.status, 'playing');
  assert.equal(state.pending, '0123');
  assert.equal(state.remaining, 5040);
});

test('solver game works for 3 and 5 digits', () => {
  for (const [digits, secret] of [[3, '907'], [5, '31750']]) {
    const game = createGame({ mode: 'solve', digits, leadingZero: true, level: 'hard', seed: 1 });
    while (game.getState().status === 'playing') {
      const { bulls, cows } = score(secret, game.getState().pending);
      assert.equal(game.answer(bulls, cows).ok, true);
    }
    assert.equal(game.getState().history.at(-1).guess, secret);
    assert.ok(game.getState().guesses <= 8);
  }
});

test('demo: a fixed guessing game with five guesses and marked notes', () => {
  const state = createDemoGame().getState();
  assert.deepEqual(createDemoGame().getState(), state, 'the demo is deterministic');
  assert.equal(state.mode, 'guess');
  assert.equal(state.status, 'playing');
  assert.equal(state.secret, null);
  assert.equal(state.history.length, 5);
  assert.ok(state.history.every((entry) => entry.bulls < 4));
  const excluded = state.notes.flatMap((mark, d) => (mark === 'excluded' ? [String(d)] : []));
  const confirmed = state.notes.flatMap((mark, d) => (mark === 'confirmed' ? [String(d)] : []));
  assert.ok(excluded.length >= 2 && confirmed.length >= 2, 'some digits marked each way');
  assert.ok(state.notes.includes('none'), 'and some left open');
  const possible = consistentCodes(FOUR, state.history);
  assert.ok(possible.length >= 1 && possible.length <= 4, 'mid-game: close but not solved');
  for (const code of possible) {
    assert.ok(excluded.every((d) => !code.includes(d)), 'excluded notes are true');
    assert.ok(confirmed.every((d) => code.includes(d)), 'confirmed notes are true');
  }
});
