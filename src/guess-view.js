/**
 * "You guess" mode: the player types codes on the keypad or the keyboard,
 * marks digits in the notes strip and reads bulls and cows on the board.
 */

import { appendDigitError, canAppendDigit } from './codes.js';
import { buttonOf, byId, el, setUnavailable } from './dom.js';
import { applyMarks, markLabel, renderBoard } from './view.js';

/** @typedef {import('./game.js').GuessingGame} GuessingGame */
/** @typedef {import('./game.js').GuessState} GuessState */

/**
 * @typedef {object} ViewContext What main.js hands to each mode view.
 * @property {import('./view.js').Translate} t
 * @property {() => string} lang Current language.
 * @property {import('./view.js').Board} board
 * @property {(message: string) => void} toast Shows a short visible message.
 * @property {(message: string) => void} announce Tells screen readers.
 * @property {(mode: 'guess'|'solve', result: {digits: number, guesses: number, secret: string}) => void} onWin
 * @property {(mode: 'guess'|'solve') => void} refresh Re-renders a mode if it is open.
 */

/** Keypad order; CSS arranges the keys in rows of five or like a phone pad. */
const KEY_DIGITS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);

/** Translation keys for refused input, by error code. */
const ERROR_KEYS = Object.freeze({
  full: 'errFull',
  distinct: 'errDistinct',
  leadingZero: 'errLeadingZero',
  length: 'errLength',
  digits: 'errLength',
  repeated: 'errRepeated',
  over: 'errOver',
});

/**
 * Builds the guessing view around the static markup in index.html.
 * @param {ViewContext} ctx
 */
export function createGuessView(ctx) {
  const dom = {
    pad: byId('pad'),
    slots: byId('slots'),
    del: byId('key-delete'),
    ok: byId('key-guess'),
    notes: byId('notes'),
  };
  const keys = KEY_DIGITS.map((digit) => dom.pad.appendChild(digitButton('key', digit)));
  const chips = Array.from({ length: 10 }, (_, digit) => dom.notes.appendChild(digitButton('note', digit)));
  keys.forEach((key, i) => {
    key.style.gridArea = `k${KEY_DIGITS[i]}`;
  });
  /** @type {GuessingGame} */
  let game;
  let entry = '';
  let animateLast = false;

  dom.pad.addEventListener('click', (event) => {
    const key = buttonOf(event);
    if (key === dom.del) deleteDigit();
    else if (key === dom.ok) submit();
    else if (key) typeDigit(Number(key.dataset.digit));
  });
  dom.notes.addEventListener('click', (event) => {
    const chip = buttonOf(event);
    if (chip) cycleNote(Number(chip.dataset.digit));
  });
  dom.slots.addEventListener('animationend', () => dom.slots.classList.remove('is-shaking'));

  /** @param {number} digit */
  function typeDigit(digit) {
    const state = game.getState();
    const error = state.status === 'playing' ? appendDigitError(entry, digit, state) : 'over';
    if (error) {
      refuse(error, state.digits);
      return;
    }
    entry += String(digit);
    renderEntry(state);
  }

  function deleteDigit() {
    if (entry === '') return;
    entry = entry.slice(0, -1);
    renderEntry(game.getState());
  }

  function clearEntry() {
    entry = '';
    renderEntry(game.getState());
  }

  function submit() {
    const result = game.guess(entry);
    if (!result.ok) {
      refuse(result.error, game.getState().digits);
      return;
    }
    const code = entry;
    entry = '';
    animateLast = true;
    render();
    ctx.announce(ctx.t('resultGuess', { code, b: result.bulls, c: result.cows }));
    if (result.won) {
      const { digits, guesses } = game.getState();
      ctx.onWin('guess', { digits, guesses, secret: code });
    }
  }

  /** @param {number} digit */
  function cycleNote(digit) {
    game.cycleNote(digit);
    renderMarks(game.getState());
  }

  /**
   * Explains refused input with a toast and a shake of the slots.
   * @param {string} error An error code from ERROR_KEYS.
   * @param {number} digits
   */
  function refuse(error, digits) {
    ctx.toast(ctx.t(ERROR_KEYS[error], { n: digits, code: entry }));
    dom.slots.classList.remove('is-shaking');
    void dom.slots.offsetWidth; // restart the shake animation
    dom.slots.classList.add('is-shaking');
  }

  /** @param {GuessState} state */
  function renderEntry(state) {
    const playing = state.status === 'playing';
    renderSlots(playing ? entry : state.secret ?? '', state.digits, !playing);
    keys.forEach((key, i) => setUnavailable(key, !playing || !canAppendDigit(entry, KEY_DIGITS[i], state)));
    setUnavailable(dom.del, !playing || entry === '');
    const ready = playing && entry.length === state.digits;
    setUnavailable(dom.ok, !ready);
    dom.ok.classList.toggle('is-ready', ready);
  }

  /**
   * @param {string} code Digits to show.
   * @param {number} digits
   * @param {boolean} solved
   */
  function renderSlots(code, digits, solved) {
    const slots = Array.from({ length: digits }, (_, i) => {
      let className = 'slot';
      if (i < code.length) className += ' is-filled';
      else if (i === code.length && !solved) className += ' is-next';
      return el('span', { className, text: code[i] ?? '' });
    });
    dom.slots.replaceChildren(...slots);
    dom.slots.classList.toggle('is-solved', solved);
    const label = code ? ctx.t('slotsLabel', { code: [...code].join(' ') }) : ctx.t('slotsEmpty');
    dom.slots.setAttribute('aria-label', label);
  }

  /** @param {GuessState} state */
  function renderMarks(state) {
    for (const root of [ctx.board.list, dom.pad, dom.notes]) applyMarks(root, state.notes);
    for (const button of [...keys, ...chips]) {
      const digit = Number(button.dataset.digit);
      button.setAttribute('aria-label', markLabel(ctx.t, digit, state.notes[digit]));
    }
  }

  /** Draws the board, notes, slots and keypad. */
  function render() {
    const state = game.getState();
    renderBoard(ctx.board, ctx.t, {
      title: ctx.t('boardGuess'),
      emptyText: ctx.t('emptyGuess', { n: state.digits }),
      history: state.history,
      digits: state.digits,
      animateLast,
    });
    animateLast = false;
    renderMarks(state);
    renderEntry(state);
  }

  /**
   * Handles a key press while this mode is open.
   * @param {KeyboardEvent} event
   * @returns {boolean} Whether the key was used.
   */
  function handleKey(event) {
    const noteDigit = /^(?:Digit|Numpad)(\d)$/.exec(event.code);
    if (/^\d$/.test(event.key)) typeDigit(Number(event.key));
    else if (event.shiftKey && noteDigit) cycleNote(Number(noteDigit[1]));
    else if (event.key === 'Backspace' || event.key === 'Delete') deleteDigit();
    else if (event.key === 'Enter') submit();
    else if (event.key === 'Escape') clearEntry();
    else return false;
    return true;
  }

  return {
    /**
     * Shows a game, optionally with some digits already typed (demo).
     * @param {GuessingGame} next
     * @param {string} [typed]
     */
    setGame(next, typed = '') {
      game = next;
      entry = typed;
      animateLast = false;
    },
    render,
    handleKey,
  };
}

/**
 * A button showing one digit; data-digit lets note marks reach it.
 * @param {string} className
 * @param {number} digit
 * @returns {HTMLElement}
 */
function digitButton(className, digit) {
  return el('button', { className, text: String(digit), attrs: { type: 'button' }, data: { digit: String(digit) } });
}
