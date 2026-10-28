/**
 * "Computer guesses" mode: the computer shows a guess, the player answers
 * with bulls and cows on two steppers, and contradictions are pointed out.
 */

import { isPossibleAnswer, stepAnswer } from './codes.js';
import { afterPaint, buttonOf, byId, setUnavailable } from './dom.js';
import { formatList } from './i18n.js';
import { buildBlankTiles, buildTiles, renderBoard } from './view.js';

/** @typedef {import('./game.js').SolverGame} SolverGame */
/** @typedef {import('./game.js').SolveState} SolveState */
/** @typedef {import('./codes.js').Score} Score */

/** Translation keys of the leading zero sentence, by setting. */
const ZERO_KEYS = Object.freeze({ true: 'zeroAllowed', false: 'zeroBanned' });

/** @type {Readonly<Score>} */
const NO_ANSWER = Object.freeze({ bulls: 0, cows: 0 });

/**
 * Builds the solver view around the static markup in index.html.
 * @param {import('./guess-view.js').ViewContext} ctx
 */
export function createSolveView(ctx) {
  const dom = {
    title: byId('solve-title'),
    intro: byId('solve-intro'),
    guess: byId('solve-guess'),
    remaining: byId('remaining'),
    steppers: byId('steppers'),
    bulls: byId('bulls-value'),
    cows: byId('cows-value'),
    alert: byId('solve-alert'),
    answer: byId('answer'),
    undo: byId('undo'),
  };
  const stepButtons = [...dom.steppers.querySelectorAll('button')];
  /** @type {SolverGame} */
  let game;
  /** @type {Score} The answer being entered. */
  let draft = NO_ANSWER;
  let thinking = false;
  let animateLast = false;

  dom.steppers.addEventListener('click', (event) => {
    const button = buttonOf(event);
    if (button) step(button.dataset.field, Number(button.dataset.step));
  });
  dom.answer.addEventListener('click', submit);
  dom.undo.addEventListener('click', undo);

  /**
   * Moves the bulls or cows of the answer being entered. The whole view is
   * redrawn so clash flags on the board follow the answer shown.
   * @param {string} field 'bulls' or 'cows'.
   * @param {number} delta
   */
  function step(field, delta) {
    const state = game.getState();
    if (thinking || state.status !== 'playing') return;
    const next = stepAnswer(draft, /** @type {'bulls'|'cows'} */ (field), delta, state.digits);
    if (next === draft) return;
    draft = next;
    render();
  }

  /**
   * Sends the answer. The next guess can take a moment with 5 digits, so the
   * "thinking" state is painted first and the work runs after that frame.
   */
  function submit() {
    const state = game.getState();
    const { bulls, cows } = draft;
    if (thinking || state.status !== 'playing' || !isPossibleAnswer(bulls, cows, state.digits)) return;
    thinking = true;
    renderCard(state);
    const current = game;
    afterPaint(() => {
      if (game !== current) return; // a new game started meanwhile
      const result = game.answer(bulls, cows);
      thinking = false;
      if (result.ok) {
        draft = NO_ANSWER;
        animateLast = true;
      }
      ctx.refresh('solve');
      reportResult(result);
    });
  }

  /** @param {import('./game.js').ActionResult} result */
  function reportResult(result) {
    const state = game.getState();
    if (result.won) {
      const secret = state.history[state.history.length - 1].guess;
      ctx.onWin('solve', { digits: state.digits, guesses: state.guesses, secret });
    } else if (result.ok) {
      ctx.announce(ctx.t('resultSolve', { code: state.pending }));
    }
  }

  /**
   * Takes the last answer back and puts it on the steppers again. Not after
   * a win: that game is already counted in the statistics.
   */
  function undo() {
    const state = game.getState();
    const last = state.history.at(-1);
    if (thinking || state.status !== 'playing' || !last) return;
    game.undo();
    draft = { bulls: last.bulls, cows: last.cows };
    render();
  }

  /**
   * The conflict to show: only while the steppers still hold the refused answer.
   * @param {SolveState} state
   * @returns {import('./game.js').Conflict|null}
   */
  function shownConflict(state) {
    const { conflict } = state;
    return conflict && conflict.bulls === draft.bulls && conflict.cows === draft.cows ? conflict : null;
  }

  /**
   * @param {SolveState} state
   * @returns {{kind: string, text: string}|null}
   */
  function alertFor(state) {
    const answer = ctx.t('answerText', { b: draft.bulls, c: draft.cows });
    const conflict = shownConflict(state);
    if (conflict) {
      const refs = conflict.entries.map((i) => ctx.t('guessRef', { n: i + 1 }));
      return { kind: 'danger', text: ctx.t('conflict', { answer, list: formatList(ctx.lang(), refs) }) };
    }
    if (!isPossibleAnswer(draft.bulls, draft.cows, state.digits)) {
      return { kind: 'warning', text: ctx.t('impossible', { answer, b: draft.bulls }) };
    }
    return null;
  }

  /** @param {SolveState} state */
  function renderGuess(state) {
    const playing = state.status === 'playing';
    const code = playing ? state.pending : state.history[state.history.length - 1].guess;
    if (thinking) dom.title.textContent = ctx.t('thinking');
    else if (playing) dom.title.textContent = ctx.t('solveTitle', { n: state.guesses + 1 });
    else dom.title.textContent = ctx.t('winSolveTitle');
    dom.guess.replaceChildren(...(thinking ? buildBlankTiles(state.digits) : buildTiles(code)));
    dom.guess.classList.toggle('is-thinking', thinking);
    dom.guess.classList.toggle('is-solved', !playing);
    dom.guess.setAttribute('aria-label', thinking ? ctx.t('thinking') : ctx.t('guessLabel', { code }));
    dom.remaining.textContent = ctx.t('remaining', { n: state.remaining });
  }

  /** @param {SolveState} state */
  function renderCard(state) {
    const playing = state.status === 'playing';
    const locked = thinking || !playing;
    dom.intro.textContent = ctx.t('solveIntro', { n: state.digits, zero: ctx.t(ZERO_KEYS[state.leadingZero]) });
    renderGuess(state);
    dom.bulls.textContent = String(draft.bulls);
    dom.cows.textContent = String(draft.cows);
    for (const button of stepButtons) {
      const field = /** @type {'bulls'|'cows'} */ (button.dataset.field);
      const moved = stepAnswer(draft, field, Number(button.dataset.step), state.digits);
      setUnavailable(button, locked || moved === draft);
    }
    const alert = alertFor(state);
    dom.alert.hidden = alert === null;
    dom.alert.dataset.kind = alert?.kind ?? '';
    if (dom.alert.textContent !== (alert?.text ?? '')) dom.alert.textContent = alert?.text ?? '';
    setUnavailable(dom.answer, locked || !isPossibleAnswer(draft.bulls, draft.cows, state.digits));
    setUnavailable(dom.undo, locked || state.history.length === 0);
  }

  /** Draws the board and the answer card. */
  function render() {
    const state = game.getState();
    renderBoard(ctx.board, ctx.t, {
      title: ctx.t('boardSolve'),
      emptyText: ctx.t('emptySolve'),
      history: state.history,
      digits: state.digits,
      flagged: shownConflict(state)?.entries ?? [],
      animateLast,
    });
    animateLast = false;
    renderCard(state);
  }

  /**
   * Handles a key press while this mode is open: B adds a bull, C (or I,
   * for the Turkish "inek") adds a cow, Shift removes one.
   * @param {KeyboardEvent} event
   * @returns {boolean} Whether the key was used.
   */
  function handleKey(event) {
    const key = event.key.toLocaleLowerCase('tr');
    const delta = event.shiftKey ? -1 : 1;
    if (key === 'b') step('bulls', delta);
    else if (key === 'c' || key === 'i' || key === 'ı') step('cows', delta);
    else if (event.key === 'Enter') submit();
    else if (event.key === 'Backspace') undo();
    else return false;
    return true;
  }

  return {
    /** @param {SolverGame} next */
    setGame(next) {
      game = next;
      draft = NO_ANSWER;
      thinking = false;
      animateLast = false;
    },
    render,
    handleKey,
  };
}
