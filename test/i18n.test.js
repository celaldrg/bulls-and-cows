import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  formatList,
  formatNumber,
  LANGUAGES,
  nextLanguage,
  normalizeLanguage,
  STRINGS,
  translate,
} from '../src/i18n.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const body = html.slice(html.indexOf('<body'));
const srcDir = new URL('../src/', import.meta.url);
const uiSources = readdirSync(srcDir)
  .filter((name) => name.endsWith('.js') && name !== 'i18n.js')
  .map((name) => readFileSync(new URL(name, srcDir), 'utf8'));

/**
 * Placeholder names of an entry; for a plural entry, of all its forms.
 * @param {string|Record<string, string>} entry
 * @returns {string[]}
 */
function placeholders(entry) {
  const forms = typeof entry === 'string' ? [entry] : Object.values(entry);
  const names = new Set();
  for (const form of forms) for (const match of form.matchAll(/\{(\w+)\}/g)) names.add(match[1]);
  return [...names].sort();
}

/**
 * Values of one data attribute across the page.
 * @param {string} attribute
 * @returns {string[]}
 */
function attributeValues(attribute) {
  return [...html.matchAll(new RegExp(`\\s${attribute}="([^"]+)"`, 'g'))].map((match) => match[1]);
}

test('English and Turkish define exactly the same keys', () => {
  assert.deepEqual(LANGUAGES, ['en', 'tr']);
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), Object.keys(STRINGS.en).sort());
});

test('every translation keeps the placeholders of the English string', () => {
  for (const [key, entry] of Object.entries(STRINGS.en)) {
    assert.deepEqual(placeholders(STRINGS.tr[key]), placeholders(entry), `placeholders of "${key}"`);
  }
});

test('plural entries always have an "other" form and only known categories', () => {
  for (const lang of LANGUAGES) {
    for (const [key, entry] of Object.entries(STRINGS[lang])) {
      if (typeof entry === 'string') continue;
      assert.equal(typeof entry.other, 'string', `${lang}.${key} needs an "other" form`);
      for (const category of Object.keys(entry)) {
        assert.ok(['zero', 'one', 'two', 'few', 'many', 'other'].includes(category), `${lang}.${key}.${category}`);
      }
    }
  }
});

test('no string is empty', () => {
  for (const lang of LANGUAGES) {
    for (const [key, entry] of Object.entries(STRINGS[lang])) {
      const forms = typeof entry === 'string' ? [entry] : Object.values(entry);
      for (const form of forms) assert.ok(form.trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test('the language button shows the language it switches to', () => {
  for (const lang of LANGUAGES) {
    assert.equal(STRINGS[lang].langButton, nextLanguage(lang).toUpperCase());
  }
});

test('every data-i18n and data-i18n-aria key in index.html exists', () => {
  const keys = [...attributeValues('data-i18n'), ...attributeValues('data-i18n-aria')];
  assert.ok(keys.length > 20, 'the page should be translated through data attributes');
  for (const key of keys) assert.ok(key in STRINGS.en, `unknown key "${key}" in index.html`);
});

test('every string is used by the page or the UI modules', () => {
  const corpus = [html, ...uiSources].join('\n');
  for (const key of Object.keys(STRINGS.en)) {
    assert.ok(corpus.includes(`'${key}'`) || corpus.includes(`"${key}"`), `unused key "${key}"`);
  }
});

test('visible text in the page body always comes from a translation', () => {
  for (const match of body.matchAll(/<(\/?)([a-z][a-z0-9]*)([^>]*)>([^<]*)/gi)) {
    const [, closing, tag, attributes, text] = match;
    if (!/\p{L}/u.test(text)) continue;
    assert.ok(!closing, `untranslated text "${text.trim()}" after </${tag}>`);
    assert.match(attributes, /\sdata-i18n="/, `untranslated text "${text.trim()}" in <${tag}>`);
  }
});

test('labels in the page body are set through data-i18n-aria, not hard-coded', () => {
  assert.doesNotMatch(body, /\s(aria-label|title|alt|placeholder)="/);
});

test('translate fills placeholders and formats numbers for the language', () => {
  assert.equal(translate('en', 'errLength', { n: 4 }), 'Enter 4 digits first.');
  assert.equal(translate('tr', 'errLength', { n: 4 }), 'Önce 4 rakam gir.');
  assert.equal(translate('en', 'resultGuess', { code: '0123', b: 1, c: 2 }), '0123: bulls 1, cows 2');
  assert.equal(translate('en', 'remaining', { n: 5040 }), '5,040 possible numbers left');
  assert.equal(translate('tr', 'remaining', { n: 5040 }), '5.040 olası sayı kaldı');
});

test('translate picks the plural form from n', () => {
  assert.equal(translate('en', 'remaining', { n: 1 }), '1 possible number left');
  assert.equal(translate('en', 'remaining', { n: 2 }), '2 possible numbers left');
  assert.equal(translate('en', 'winGuessText', { code: '4071', n: 1 }), 'The secret was 4071. You needed just 1 guess.');
  assert.equal(translate('en', 'winGuessText', { code: '4071', n: 6 }), 'The secret was 4071. You needed 6 guesses.');
  assert.equal(translate('tr', 'winGuessText', { code: '4071', n: 6 }), 'Gizli sayı 4071 idi. 6 tahminde buldun.');
});

test('translate falls back safely', () => {
  assert.equal(translate('de', 'newGame'), 'New game');
  assert.equal(translate('tr', 'no-such-key'), 'no-such-key');
  assert.equal(translate('en', 'errLength'), 'Enter {n} digits first.');
});

test('formatNumber and formatList follow each language', () => {
  assert.equal(formatNumber('en', 5040), '5,040');
  assert.equal(formatNumber('tr', 5040), '5.040');
  assert.equal(formatNumber('en', 4.56), '4.6');
  assert.equal(formatNumber('tr', 4.56), '4,6');
  assert.equal(formatNumber('en', 4.5, 0), '5');
  assert.equal(formatList('en', ['#1', '#3']), '#1 and #3');
  assert.equal(formatList('tr', ['#1', '#2', '#4']), '#1, #2 ve #4');
  assert.equal(formatList('en', ['#2']), '#2');
});

test('normalizeLanguage and nextLanguage', () => {
  assert.equal(normalizeLanguage('tr'), 'tr');
  assert.equal(normalizeLanguage('en'), 'en');
  for (const junk of ['de', 'TR', '', null, undefined, 5, {}]) assert.equal(normalizeLanguage(junk), 'en');
  assert.equal(nextLanguage('en'), 'tr');
  assert.equal(nextLanguage('tr'), 'en');
  assert.equal(nextLanguage('xx'), 'tr');
});
