/**
 * DOM builders shared by both modes: digit tiles, peg clusters and the
 * history board. Strings come in through a translate function `t`.
 */

import { el } from './dom.js';

/** @typedef {import('./solver.js').Answer} Answer */
/** @typedef {(key: string, params?: Record<string, string|number>) => string} Translate */

/**
 * @typedef {object} Board The history card shared by both modes.
 * @property {HTMLElement} title
 * @property {HTMLElement} count
 * @property {HTMLElement} empty
 * @property {HTMLElement} list
 */

/** Rows the board shows at least on wide screens; the missing ones are drawn empty. */
const BOARD_ROWS = 7;

/** Translation keys of the visible note marks ('none' has no label). */
const MARK_KEYS = Object.freeze({ excluded: 'markExcluded', confirmed: 'markConfirmed' });

/**
 * One tile per digit of a code. Each tile carries its digit in data-digit,
 * so note marks can be applied to it.
 * @param {string} code
 * @param {string} [className]
 * @returns {HTMLElement[]}
 */
export function buildTiles(code, className = 'tile') {
  return [...code].map((digit) => el('span', { className, text: digit, data: { digit } }));
}

/**
 * Empty tiles, for rows still to come and for the "thinking" state.
 * @param {number} digits
 * @param {string} [className]
 * @returns {HTMLElement[]}
 */
export function buildBlankTiles(digits, className = 'tile') {
  return Array.from({ length: digits }, (_, i) => {
    const tile = el('span', { className: `${className} is-blank` });
    tile.style.setProperty('--i', String(i));
    return tile;
  });
}

/**
 * A small cluster of pegs: bulls first, then cows, then empty holes.
 * @param {number} bulls
 * @param {number} cows
 * @param {number} digits
 * @returns {HTMLElement}
 */
function buildPegs(bulls, cows, digits) {
  const pegs = Array.from({ length: digits }, (_, i) => {
    let kind = 'peg';
    if (i < bulls) kind += ' peg-bull';
    else if (i < bulls + cows) kind += ' peg-cow';
    const peg = el('i', { className: kind });
    peg.style.setProperty('--i', String(i));
    return peg;
  });
  const cluster = el('span', { className: 'pegs' }, pegs);
  cluster.style.setProperty('--cols', String(Math.ceil(digits / 2)));
  return cluster;
}

/**
 * @param {Answer} entry
 * @param {number} index
 * @param {number} digits
 * @param {Translate} t
 * @param {{flagged: boolean, fresh: boolean}} flags
 * @returns {HTMLElement}
 */
function buildRow(entry, index, digits, t, { flagged, fresh }) {
  const classes = ['row'];
  if (flagged) classes.push('is-flagged');
  if (fresh) classes.push('is-fresh');
  if (entry.bulls === digits) classes.push('is-win');
  const visual = [
    el('span', { className: 'row-index', text: String(index + 1) }),
    el('span', { className: 'tiles' }, buildTiles(entry.guess)),
    buildPegs(entry.bulls, entry.cows, digits),
    el('span', { className: 'counts' }, [
      el('b', { className: 'count-bulls', text: t('countBulls', { n: entry.bulls }) }),
      el('b', { className: 'count-cows', text: t('countCows', { n: entry.cows }) }),
    ]),
  ];
  if (flagged) visual.push(el('span', { className: 'flag', text: '!', attrs: { title: t('conflictFlag') } }));
  const label = t('rowLabel', { i: index + 1, code: entry.guess, b: entry.bulls, c: entry.cows });
  return el('li', { className: classes.join(' ') }, [
    el('span', { className: 'sr-only', text: label }),
    el('span', { className: 'row-visual', attrs: { 'aria-hidden': 'true' } }, visual),
  ]);
}

/**
 * A placeholder row for a guess still to come (shown on wide screens only).
 * @param {number} index
 * @param {number} digits
 * @returns {HTMLElement}
 */
function buildGhostRow(index, digits) {
  return el('li', { className: 'row row-ghost', attrs: { 'aria-hidden': 'true' } }, [
    el('span', { className: 'row-visual' }, [
      el('span', { className: 'row-index', text: String(index + 1) }),
      el('span', { className: 'tiles' }, buildBlankTiles(digits)),
      buildPegs(0, 0, digits),
    ]),
  ]);
}

/**
 * @typedef {object} BoardView
 * @property {string} title
 * @property {string} emptyText Shown while the history is empty.
 * @property {readonly Answer[]} history
 * @property {number} digits
 * @property {readonly number[]} [flagged] History indices to flag as clashing.
 * @property {boolean} [animateLast] Slide the newest row in.
 */

/**
 * Renders the history board and scrolls it to the newest guess.
 * @param {Board} board
 * @param {Translate} t
 * @param {BoardView} view
 */
export function renderBoard(board, t, { title, emptyText, history, digits, flagged = [], animateLast = false }) {
  board.title.textContent = title;
  board.count.textContent = String(history.length);
  board.count.hidden = history.length === 0;
  board.empty.textContent = emptyText;
  board.empty.hidden = history.length > 0;
  const rows = history.map((entry, i) =>
    buildRow(entry, i, digits, t, {
      flagged: flagged.includes(i),
      fresh: animateLast && i === history.length - 1,
    }),
  );
  for (let i = history.length; i < BOARD_ROWS; i++) rows.push(buildGhostRow(i, digits));
  board.list.dataset.digits = String(digits);
  board.list.replaceChildren(...rows);
  if (history.length > 0) scrollToRow(board.list, rows[history.length - 1]);
}

/**
 * Scrolls a list (a positioned element) just far enough to show the bottom
 * of `row`, so the newest guess is in view without the page itself moving.
 * @param {HTMLElement} list
 * @param {HTMLElement} row
 */
function scrollToRow(list, row) {
  list.scrollTop = Math.max(0, row.offsetTop + row.offsetHeight - list.clientHeight);
}

/**
 * Writes each digit's note mark to every element with a data-digit inside
 * `root`, so CSS can show excluded and confirmed digits.
 * @param {HTMLElement} root
 * @param {readonly string[]} notes One mark per digit 0-9.
 */
export function applyMarks(root, notes) {
  for (const node of root.querySelectorAll('[data-digit]')) {
    node.dataset.mark = notes[Number(node.dataset.digit)];
  }
}

/**
 * Accessible name of a digit button, including its note mark.
 * @param {Translate} t
 * @param {number} digit
 * @param {string} mark
 * @returns {string}
 */
export function markLabel(t, digit, mark) {
  const key = MARK_KEYS[mark];
  return key ? t('digitMark', { d: String(digit), mark: t(key) }) : String(digit);
}
