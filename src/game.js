/**
 * Game state for both modes, free of DOM and storage so tests can drive it:
 *  - 'guess': the player cracks the computer's secret.
 *  - 'solve': the computer cracks the player's secret from bulls/cows answers.
 * Each game is an object with action methods and a getState() snapshot.
 */

import { allCodes, isPossibleAnswer, normalizeConfig, randomCode, score, validateCode } from './codes.js';
import { createRng, randomSeed } from './rng.js';
import {
  LEVELS,
  consistentCodes,
  filterCandidates,
  findConflict,
  minimaxGuess,
  randomCandidate,
} from './solver.js';

/** Game modes, shown as tabs. */
export const MODES = Object.freeze(['guess', 'solve']);

/** Marks for the notes strip, in the order a tap cycles through them. */
export const NOTE_MARKS = Object.freeze(['none', 'excluded', 'confirmed']);

/** @typedef {import('./solver.js').Answer} Answer */
/** @typedef {'playing'|'won'} Status */

/**
 * @typedef {object} GameOptions
 * @property {'guess'|'solve'} [mode] Defaults to 'guess'.
 * @property {number} [digits] 3-5, defaults to 4.
 * @property {boolean} [leadingZero] Whether codes may start with 0 (default true).
 * @property {'hard'|'easy'} [level] Solver strength in 'solve' mode (default 'hard').
 * @property {number} [seed] Seed for the game's random choices.
 * @property {import('./rng.js').Rng} [rng] Random source; overrides `seed`.
 */

/**
 * @typedef {object} GuessState
 * @property {'guess'} mode
 * @property {number} digits
 * @property {boolean} leadingZero
 * @property {Status} status
 * @property {Answer[]} history The player's guesses with their bulls and cows.
 * @property {string[]} notes One NOTE_MARKS entry per digit 0-9.
 * @property {number} guesses Number of guesses so far.
 * @property {string|null} secret Revealed once the game is won.
 */

/**
 * @typedef {object} Conflict
 * @property {number} bulls The rejected answer.
 * @property {number} cows
 * @property {number[]} entries History indices of the answers it contradicts.
 *   Never empty: answers that no code can get are refused as 'invalid'
 *   first, so a contradiction always involves earlier answers.
 */

/**
 * @typedef {object} SolveState
 * @property {'solve'} mode
 * @property {number} digits
 * @property {boolean} leadingZero
 * @property {'hard'|'easy'} level
 * @property {Status} status
 * @property {Answer[]} history The computer's guesses with the player's answers.
 * @property {string|null} pending The guess waiting for an answer (null once won).
 * @property {number} remaining Codes still consistent with every answer.
 * @property {Conflict|null} conflict Set when the last answer was rejected.
 * @property {number} guesses Number of answered guesses.
 */

/**
 * @typedef {object} ActionResult
 * @property {boolean} ok
 * @property {string} [error] Why the action was refused: a code error from
 *   validateCode, 'repeated', 'invalid', 'contradiction' or 'over'.
 * @property {number} [bulls]
 * @property {number} [cows]
 * @property {boolean} [won]
 * @property {number[]} [entries] For 'contradiction': the clashing history indices.
 */

/**
 * @typedef {object} GuessingGame
 * @property {() => GuessState} getState
 * @property {(code: string) => ActionResult} guess
 * @property {(digit: number) => string} cycleNote
 */

/**
 * @typedef {object} SolverGame
 * @property {() => SolveState} getState
 * @property {(bulls: number, cows: number) => ActionResult} answer
 * @property {() => boolean} undo
 */

/**
 * Starts a game in the requested mode.
 * @param {GameOptions} [options]
 * @returns {GuessingGame|SolverGame}
 */
export function createGame(options = {}) {
  return options.mode === 'solve' ? createSolverGame(options) : createGuessingGame(options);
}

/**
 * @param {GameOptions} options
 * @returns {import('./rng.js').Rng}
 */
function rngFrom(options) {
  return options.rng ?? createRng(options.seed ?? randomSeed());
}

/**
 * @param {readonly Answer[]} history
 * @returns {Answer[]}
 */
function copyHistory(history) {
  return history.map((entry) => ({ ...entry }));
}

/**
 * The player guesses a secret picked by the computer.
 * @param {GameOptions & {secret?: string}} [options] `secret` fixes the
 *   secret instead of drawing it at random (demo and tests).
 * @returns {GuessingGame}
 */
export function createGuessingGame(options = {}) {
  const config = normalizeConfig(options);
  const secret = options.secret ?? randomCode(config, rngFrom(options));
  if (validateCode(secret, config) !== null) throw new RangeError(`Invalid secret: ${secret}`);
  /** @type {Answer[]} */
  const history = [];
  const notes = Array.from({ length: 10 }, () => NOTE_MARKS[0]);
  /** @type {Status} */
  let status = 'playing';

  return {
    /** @returns {GuessState} */
    getState() {
      return {
        mode: 'guess',
        ...config,
        status,
        history: copyHistory(history),
        notes: [...notes],
        guesses: history.length,
        secret: status === 'won' ? secret : null,
      };
    },

    /**
     * Scores a guess and records it.
     * @param {string} code
     * @returns {ActionResult}
     */
    guess(code) {
      if (status !== 'playing') return { ok: false, error: 'over' };
      const repeated = history.some((entry) => entry.guess === code);
      const error = validateCode(code, config) ?? (repeated ? 'repeated' : null);
      if (error) return { ok: false, error };
      const { bulls, cows } = score(secret, code);
      history.push({ guess: code, bulls, cows });
      if (bulls === config.digits) status = 'won';
      return { ok: true, bulls, cows, won: status === 'won' };
    },

    /**
     * Moves a digit's note to the next mark: none, excluded, confirmed, none...
     * @param {number} digit 0-9.
     * @returns {string} The new mark.
     */
    cycleNote(digit) {
      if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        throw new RangeError(`Not a digit: ${digit}`);
      }
      const next = (NOTE_MARKS.indexOf(notes[digit]) + 1) % NOTE_MARKS.length;
      notes[digit] = NOTE_MARKS[next];
      return notes[digit];
    },
  };
}

/**
 * The computer guesses the player's secret; the player answers each guess
 * with bulls and cows. Answers that contradict earlier ones are refused and
 * explained, and undo() takes the last answer back.
 * @param {GameOptions} [options]
 * @returns {SolverGame}
 */
export function createSolverGame(options = {}) {
  const config = normalizeConfig(options);
  const level = LEVELS.includes(options.level) ? options.level : LEVELS[0];
  const rng = rngFrom(options);
  /** @type {Answer[]} */
  const history = [];
  /** @type {readonly string[]} */
  let candidates = allCodes(config);
  /** @type {Status} */
  let status = 'playing';
  /** @type {Conflict|null} */
  let conflict = null;
  /** @type {string|null} */
  let pending = chooseGuess();

  /** @returns {string} */
  function chooseGuess() {
    if (level === 'easy') return randomCandidate(candidates, rng);
    return minimaxGuess(config, candidates, history.map((entry) => entry.guess));
  }

  return {
    /** @returns {SolveState} */
    getState() {
      return {
        mode: 'solve',
        ...config,
        level,
        status,
        history: copyHistory(history),
        pending,
        remaining: candidates.length,
        conflict: conflict && { ...conflict, entries: [...conflict.entries] },
        guesses: history.length,
      };
    },

    /**
     * Answers the pending guess.
     * @param {number} bulls
     * @param {number} cows
     * @returns {ActionResult}
     */
    answer(bulls, cows) {
      if (status !== 'playing') return { ok: false, error: 'over' };
      if (!isPossibleAnswer(bulls, cows, config.digits)) return { ok: false, error: 'invalid' };
      const entry = { guess: pending, bulls, cows };
      const next = filterCandidates(candidates, entry);
      if (next.length === 0) {
        conflict = { bulls, cows, entries: findConflict(config, history, entry) };
        return { ok: false, error: 'contradiction', entries: [...conflict.entries] };
      }
      history.push(entry);
      candidates = next;
      conflict = null;
      if (bulls === config.digits) {
        status = 'won';
        pending = null;
      } else {
        pending = chooseGuess();
      }
      return { ok: true, bulls, cows, won: status === 'won' };
    },

    /**
     * Takes back the last answer; its guess becomes pending again.
     * @returns {boolean} False when there is nothing to undo.
     */
    undo() {
      const last = history.pop();
      if (!last) return false;
      pending = last.guess;
      candidates = consistentCodes(config, history);
      status = 'playing';
      conflict = null;
      return true;
    },
  };
}

/** The fixed mid-game behind "?demo" (README screenshot). */
const DEMO = Object.freeze({
  secret: '6394',
  guesses: ['0123', '4567', '3469', '8396', '9364'],
  notes: [
    [0, 'excluded'],
    [1, 'excluded'],
    [2, 'excluded'],
    [7, 'excluded'],
    [8, 'excluded'],
    [3, 'confirmed'],
    [6, 'confirmed'],
    [9, 'confirmed'],
  ],
});

/**
 * A deterministic guessing game with five guesses played and some digits
 * marked in the notes.
 * @returns {GuessingGame}
 */
export function createDemoGame() {
  const game = createGuessingGame({ digits: 4, leadingZero: true, secret: DEMO.secret });
  for (const code of DEMO.guesses) game.guess(code);
  for (const [digit, mark] of DEMO.notes) {
    while (game.getState().notes[digit] !== mark) game.cycleNote(digit);
  }
  return game;
}
