/**
 * Tiny DOM helpers for the UI modules. Text always goes in through
 * textContent, so no markup is ever parsed from data.
 */

/**
 * @typedef {object} ElementOptions
 * @property {string} [className]
 * @property {string} [text] Set as textContent.
 * @property {Record<string, string>} [attrs]
 * @property {Record<string, string>} [data] Written to dataset.
 */

/**
 * Creates an element.
 * @param {string} tag
 * @param {ElementOptions} [options]
 * @param {Node[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, { className, text, attrs = {}, data = {} } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  Object.assign(node.dataset, data);
  node.append(...children);
  return node;
}

/**
 * Finds an element of the page by id; a missing one is a bug in index.html.
 * @param {string} id
 * @returns {HTMLElement}
 */
export function byId(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

/**
 * Marks a control as unavailable. Unlike `disabled` it stays focusable, so
 * keyboard focus is not lost and a press can still explain why nothing
 * happened.
 * @param {HTMLElement} control
 * @param {boolean} unavailable
 */
export function setUnavailable(control, unavailable) {
  control.setAttribute('aria-disabled', String(unavailable));
}

/**
 * The button an event happened on, if any (for delegated click handlers).
 * @param {Event} event
 * @returns {HTMLElement|null}
 */
export function buttonOf(event) {
  return event.target instanceof Element ? event.target.closest('button') : null;
}

/**
 * Gives every button inside `root` an instant pressed look while a finger,
 * pen or mouse is down on it (touch browsers do not always show :active).
 * @param {HTMLElement} root
 */
export function trackPresses(root) {
  const release = () => {
    for (const node of root.querySelectorAll('.is-pressed')) node.classList.remove('is-pressed');
  };
  root.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element) event.target.closest('button')?.classList.add('is-pressed');
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) root.addEventListener(type, release);
}

/** Longest wait for a frame; background tabs pause requestAnimationFrame. */
const PAINT_TIMEOUT_MS = 100;

/**
 * Runs `callback` once, after the browser has painted the current frame, so
 * a "thinking" state shows before a slow computation starts. A timer runs it
 * anyway when no frame comes (hidden tab, headless browser).
 * @param {() => void} callback
 */
export function afterPaint(callback) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    callback();
  };
  requestAnimationFrame(() => setTimeout(run, 0));
  setTimeout(run, PAINT_TIMEOUT_MS);
}
