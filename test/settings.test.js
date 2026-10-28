import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/storage.js';
import { loadLanguage, loadSettings, normalizeSettings, saveLanguage, saveSettings } from '../src/settings.js';

const DEFAULTS = Object.freeze({ mode: 'guess', digits: 4, leadingZero: true, level: 'hard' });

/** A store backed by an in-memory map, plus the map for inspection. */
function memoryStore() {
  const items = new Map();
  const backend = {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
  };
  return { items, store: createStorage(() => backend) };
}

const blockedStore = createStorage(() => ({
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('SecurityError');
  },
}));

test('normalizeSettings gives the defaults for missing or broken input', () => {
  for (const raw of [undefined, null, 'junk', 42, [], {}]) {
    assert.deepEqual(normalizeSettings(raw), DEFAULTS);
  }
  assert.deepEqual(normalizeSettings({ mode: 'race', digits: 7, leadingZero: 'yes', level: 'insane' }), DEFAULTS);
  assert.deepEqual(normalizeSettings({ digits: '5' }), DEFAULTS);
});

test('normalizeSettings keeps valid values and drops unknown fields', () => {
  const valid = { mode: 'solve', digits: 5, leadingZero: false, level: 'easy' };
  assert.deepEqual(normalizeSettings({ ...valid, theme: 'neon' }), valid);
  assert.deepEqual(normalizeSettings({ digits: 3 }), { ...DEFAULTS, digits: 3 });
});

test('settings round-trip through storage', () => {
  const { items, store } = memoryStore();
  assert.deepEqual(loadSettings(store), DEFAULTS);
  const chosen = { mode: 'solve', digits: 3, leadingZero: false, level: 'easy' };
  assert.equal(saveSettings(chosen, store), true);
  assert.ok(items.has('bulls-and-cows:settings'));
  assert.deepEqual(loadSettings(store), chosen);
});

test('saveSettings stores normalized values only', () => {
  const { items, store } = memoryStore();
  saveSettings({ mode: 'solve', digits: 9, extra: true }, store);
  assert.deepEqual(JSON.parse(items.get('bulls-and-cows:settings')), { ...DEFAULTS, mode: 'solve' });
});

test('corrupted or tampered settings fall back to the defaults', () => {
  const { items, store } = memoryStore();
  items.set('bulls-and-cows:settings', '{not json');
  assert.deepEqual(loadSettings(store), DEFAULTS);
  items.set('bulls-and-cows:settings', JSON.stringify({ digits: 5, level: 'god' }));
  assert.deepEqual(loadSettings(store), { ...DEFAULTS, digits: 5 });
});

test('blocked storage gives the defaults and reports failed saves', () => {
  assert.deepEqual(loadSettings(blockedStore), DEFAULTS);
  assert.equal(saveSettings(DEFAULTS, blockedStore), false);
  assert.equal(loadLanguage(blockedStore), 'en');
  assert.equal(saveLanguage('tr', blockedStore), false);
});

test('the language defaults to English and round-trips through storage', () => {
  const { items, store } = memoryStore();
  assert.equal(loadLanguage(store), 'en');
  assert.equal(saveLanguage('tr', store), true);
  assert.equal(items.get('bulls-and-cows:lang'), '"tr"');
  assert.equal(loadLanguage(store), 'tr');
  saveLanguage('de', store);
  assert.equal(loadLanguage(store), 'en');
  items.set('bulls-and-cows:lang', '"fr"');
  assert.equal(loadLanguage(store), 'en');
});
