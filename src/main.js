/**
 * Entry point: connects the page (mode tabs, settings, language toggle,
 * statistics, win dialog, toasts, keyboard) to the two mode views. The
 * rules live in the pure modules; this file only wires the DOM.
 */

import { buttonOf, byId, trackPresses } from './dom.js';
import { MODES, createDemoGame, createGame } from './game.js';
import { createGuessView } from './guess-view.js';
import { formatNumber, nextLanguage, translate } from './i18n.js';
import { loadLanguage, loadSettings, normalizeSettings, saveLanguage, saveSettings } from './settings.js';
import { createSolveView } from './solve-view.js';
import { loadStats, recordGame, saveStats, summarize } from './stats.js';
import { buildTiles } from './view.js';

/** @typedef {'guess'|'solve'} Mode */
/** @typedef {import('./settings.js').Settings} Settings */

/** Tab label keys by mode; the statistics name the mode with them too. */
const TAB_KEYS = Object.freeze({ guess: 'tabGuess', solve: 'tabSolve' });

/** Win dialog strings by mode. */
const WIN_KEYS = Object.freeze({
  guess: Object.freeze({ title: 'winGuessTitle', text: 'winGuessText' }),
  solve: Object.freeze({ title: 'winSolveTitle', text: 'winSolveText' }),
});

const TOAST_MS = 2600;

/** "?demo": a fixed mid-game for the README screenshot; nothing is saved. */
const isDemo = new URLSearchParams(window.location.search).has('demo');

/** Digits already typed in the demo, so the keypad is shown in use. */
const DEMO_ENTRY = '63';

const app = {
  lang: loadLanguage(),
  /** @type {Settings} */
  settings: isDemo ? normalizeSettings({ mode: 'guess', digits: 4, leadingZero: true }) : loadSettings(),
  stats: loadStats(),
  /** @type {Mode} The mode of the game shown in the win dialog. */
  winMode: 'guess',
};

const dom = {
  tabs: byId('tabs'),
  panels: { guess: byId('panel-guess'), solve: byId('panel-solve') },
  newGame: byId('new-game'),
  lang: byId('lang'),
  digits: byId('digits'),
  leadingZero: byId('leading-zero'),
  level: byId('level'),
  statsScope: byId('stats-scope'),
  statGames: byId('stat-games'),
  statAverage: byId('stat-average'),
  statBest: byId('stat-best'),
  win: /** @type {HTMLDialogElement} */ (byId('win')),
  winCode: byId('win-code'),
  winTitle: byId('win-title'),
  winText: byId('win-text'),
  winAgain: byId('win-again'),
  winClose: byId('win-close'),
  toast: byId('toast'),
  announcer: byId('announcer'),
};
const tabButtons = [...dom.tabs.querySelectorAll('[role="tab"]')];

/** @type {import('./view.js').Translate} */
const t = (key, params) => translate(app.lang, key, params);

/** @type {import('./guess-view.js').ViewContext} */
const ctx = {
  t,
  lang: () => app.lang,
  board: {
    title: byId('board-title'),
    count: byId('board-count'),
    empty: byId('board-empty'),
    list: byId('board-list'),
  },
  toast: showToast,
  announce,
  onWin: showWin,
  refresh(mode) {
    if (mode === app.settings.mode) views[mode].render();
  },
};
const views = { guess: createGuessView(ctx), solve: createSolveView(ctx) };

/* ---------- games ---------- */

/**
 * Gives a mode a fresh game with the current settings.
 * @param {Mode} mode
 */
function startGame(mode) {
  const { digits, leadingZero, level } = app.settings;
  views[mode].setGame(createGame({ mode, digits, leadingZero, level }));
}

/**
 * Starts a new game in a mode and shows it if that mode is open.
 * @param {Mode} mode
 */
function restart(mode) {
  startGame(mode);
  ctx.refresh(mode);
}

/** Redraws the open mode and the statistics. */
function renderOpenMode() {
  views[app.settings.mode].render();
  renderStats();
}

/* ---------- tabs ---------- */

/**
 * Marks the open tab and shows its panel.
 * @param {Mode} mode
 */
function selectTab(mode) {
  for (const tab of tabButtons) {
    const selected = tab.dataset.mode === mode;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const [name, panel] of Object.entries(dom.panels)) panel.hidden = name !== mode;
}

/**
 * Opens a mode tab; each mode keeps its own game.
 * @param {Mode} mode
 */
function openMode(mode) {
  if (!updateSettings({ mode })) return;
  selectTab(mode);
  renderOpenMode();
}

/**
 * The tab a key moves to from tab `index` (arrows wrap around).
 * @param {number} index
 * @param {string} key
 * @returns {number|null} Null for keys that do not move.
 */
function tabAfterKey(index, key) {
  const last = tabButtons.length - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  if (key === 'ArrowLeft') return index === 0 ? last : index - 1;
  if (key === 'ArrowRight') return index === last ? 0 : index + 1;
  return null;
}

dom.tabs.addEventListener('click', (event) => {
  const tab = buttonOf(event);
  if (tab) openMode(tab.dataset.mode);
});

dom.tabs.addEventListener('keydown', (event) => {
  const index = tabButtons.indexOf(event.target);
  const next = tabAfterKey(index, event.key);
  if (index < 0 || next === null) return;
  event.preventDefault();
  tabButtons[next].focus();
  openMode(tabButtons[next].dataset.mode);
});

/* ---------- settings ---------- */

/**
 * Applies a settings change and saves it (except in the demo).
 * @param {Partial<Settings>} patch
 * @returns {boolean} Whether anything changed.
 */
function updateSettings(patch) {
  const next = normalizeSettings({ ...app.settings, ...patch });
  if (Object.keys(patch).every((key) => next[key] === app.settings[key])) return false;
  app.settings = next;
  if (!isDemo) saveSettings(next);
  return true;
}

/**
 * Changes a code or solver setting and restarts the games it affects.
 * @param {Partial<Settings>} patch
 * @param {readonly Mode[]} modes
 */
function changeSetting(patch, modes) {
  if (!updateSettings(patch)) return;
  for (const mode of modes) startGame(mode);
  renderSettings();
  renderOpenMode();
}

/** Shows the current settings on the option buttons and the switch. */
function renderSettings() {
  const { digits, leadingZero, level } = app.settings;
  for (const button of dom.digits.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.value) === digits));
  }
  for (const button of dom.level.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.value === level));
  }
  dom.leadingZero.setAttribute('aria-checked', String(leadingZero));
}

dom.digits.addEventListener('click', (event) => {
  const button = buttonOf(event);
  if (button) changeSetting({ digits: Number(button.dataset.value) }, MODES);
});
dom.leadingZero.addEventListener('click', () => {
  changeSetting({ leadingZero: !app.settings.leadingZero }, MODES);
});
dom.level.addEventListener('click', (event) => {
  const button = buttonOf(event);
  if (button) changeSetting({ level: button.dataset.value }, ['solve']);
});
dom.newGame.addEventListener('click', () => restart(app.settings.mode));

/* ---------- statistics and win dialog ---------- */

/** Shows games, average and best guesses for the open mode and code length. */
function renderStats() {
  const { mode, digits } = app.settings;
  const { games, average, best } = summarize(app.stats, mode, digits);
  dom.statsScope.textContent = t('statsScope', { mode: t(TAB_KEYS[mode]), n: digits });
  dom.statGames.textContent = formatNumber(app.lang, games);
  dom.statAverage.textContent = games > 0 ? formatNumber(app.lang, average, 1) : '–';
  dom.statBest.textContent = games > 0 ? formatNumber(app.lang, best) : '–';
}

/**
 * Records a finished game (not in the demo) and opens the win dialog.
 * @param {Mode} mode
 * @param {{digits: number, guesses: number, secret: string}} result
 */
function showWin(mode, { digits, guesses, secret }) {
  if (!isDemo) {
    app.stats = recordGame(app.stats, mode, digits, guesses);
    saveStats(app.stats);
  }
  renderStats();
  app.winMode = mode;
  dom.winCode.replaceChildren(...buildTiles(secret));
  dom.winTitle.textContent = t(WIN_KEYS[mode].title);
  dom.winText.textContent = t(WIN_KEYS[mode].text, { code: secret, n: guesses });
  if (!dom.win.open) dom.win.showModal();
  dom.winAgain.focus();
}

dom.winAgain.addEventListener('click', () => {
  dom.win.close();
  restart(app.winMode);
});
dom.winClose.addEventListener('click', () => dom.win.close());
// A click on the backdrop lands on the dialog element itself.
dom.win.addEventListener('click', (event) => {
  if (event.target === dom.win) dom.win.close();
});

/* ---------- messages ---------- */

let toastTimer = 0;

/**
 * Shows a short message near the top of the screen (also read by screen readers).
 * @param {string} message
 */
function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('is-visible'), TOAST_MS);
}

/**
 * Tells screen readers about a result that is otherwise only drawn.
 * @param {string} message
 */
function announce(message) {
  dom.announcer.textContent = message;
}

/* ---------- language ---------- */

/** Writes every static string of the page in the current language. */
function applyLanguage() {
  document.documentElement.lang = app.lang;
  document.title = t('docTitle');
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nAria));
  }
}

dom.lang.addEventListener('click', () => {
  app.lang = nextLanguage(app.lang);
  if (!isDemo) saveLanguage(app.lang);
  applyLanguage();
  renderOpenMode();
});

/* ---------- keyboard and pointer ---------- */

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || dom.win.open || event.ctrlKey || event.metaKey || event.altKey) return;
  // Enter on a focused button presses that button.
  if (event.key === 'Enter' && event.target instanceof Element && event.target.closest('button, a')) return;
  if (views[app.settings.mode].handleKey(event)) event.preventDefault();
});

// Clicking or tapping a button does not leave focus on it (or on a button
// focused earlier with Tab), so Enter keeps going to the game.
document.addEventListener('mousedown', (event) => {
  if (!buttonOf(event)) return;
  event.preventDefault();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
});

trackPresses(document.body);

/* ---------- start ---------- */

if (isDemo) views.guess.setGame(createDemoGame(), DEMO_ENTRY);
else startGame('guess');
startGame('solve');
renderSettings();
selectTab(app.settings.mode);
applyLanguage();
renderOpenMode();
