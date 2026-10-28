import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, storage } from '../src/storage.js';
import { loadStats, recordGame, sanitizeStats, saveStats, summarize } from '../src/stats.js';

/** An in-memory stand-in for localStorage. */
function memoryBackend() {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
  };
}

const throwingBackend = {
  getItem() {
    throw new Error('SecurityError: storage is disabled');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

test('storage saves JSON under a game-specific prefix and loads it back', () => {
  const backend = memoryBackend();
  const store = createStorage(() => backend);
  assert.equal(store.save('lang', 'tr'), true);
  assert.equal(store.save('settings', { digits: 5, leadingZero: false }), true);
  assert.equal(backend.items.get('bulls-and-cows:lang'), '"tr"');
  assert.equal(store.load('lang', 'en'), 'tr');
  assert.deepEqual(store.load('settings', null), { digits: 5, leadingZero: false });
  assert.equal(store.load('missing', 'fallback'), 'fallback');
});

test('storage never throws: blocked, missing or corrupted storage gives the fallback', () => {
  const blocked = createStorage(() => throwingBackend);
  assert.equal(blocked.load('lang', 'en'), 'en');
  assert.equal(blocked.save('lang', 'tr'), false);

  const missing = createStorage(() => undefined);
  assert.equal(missing.load('lang', 'en'), 'en');
  assert.equal(missing.save('lang', 'tr'), false);

  const getterThrows = createStorage(() => {
    throw new Error('Access denied');
  });
  assert.equal(getterThrows.load('lang', 'en'), 'en');
  assert.equal(getterThrows.save('lang', 'tr'), false);

  const backend = memoryBackend();
  backend.items.set('bulls-and-cows:stats', '{not json');
  assert.equal(createStorage(() => backend).load('stats', 'fallback'), 'fallback');
});

test('the default helper loads without a browser', () => {
  assert.equal(storage.load('missing-key', 'en'), 'en');
});

test('recordGame adds games without changing its input', () => {
  const empty = {};
  const one = recordGame(empty, 'guess', 4, 6);
  assert.deepEqual(empty, {});
  const three = recordGame(recordGame(one, 'guess', 4, 4), 'guess', 4, 8);
  assert.deepEqual(three['guess-4'], { games: 3, guesses: 18, best: 4 });
  const both = recordGame(three, 'solve', 5, 7);
  assert.deepEqual(both['solve-5'], { games: 1, guesses: 7, best: 7 });
  assert.deepEqual(both['guess-4'], three['guess-4']);
});

test('summarize gives games, average and best per mode and length', () => {
  let stats = {};
  for (const guesses of [5, 6, 8]) stats = recordGame(stats, 'guess', 4, guesses);
  stats = recordGame(stats, 'solve', 4, 5);
  assert.deepEqual(summarize(stats, 'guess', 4), { games: 3, average: 19 / 3, best: 5 });
  assert.deepEqual(summarize(stats, 'solve', 4), { games: 1, average: 5, best: 5 });
  assert.deepEqual(summarize(stats, 'guess', 3), { games: 0, average: 0, best: 0 });
});

test('sanitizeStats drops anything malformed', () => {
  const raw = {
    'guess-4': { games: 2, guesses: 11, best: 5 },
    'solve-3': { games: 1, guesses: 4, best: 4, extra: 'ignored' },
    'guess-9': { games: 1, guesses: 1, best: 1 },
    'hack-4': { games: 1, guesses: 1, best: 1 },
    'solve-5': { games: -1, guesses: 3, best: 3 },
    'guess-5': { games: '2', guesses: 3, best: 3 },
    'guess-3': null,
  };
  assert.deepEqual(sanitizeStats(raw), {
    'guess-4': { games: 2, guesses: 11, best: 5 },
    'solve-3': { games: 1, guesses: 4, best: 4 },
  });
  assert.deepEqual(sanitizeStats(null), {});
  assert.deepEqual(sanitizeStats('stats'), {});
  assert.deepEqual(sanitizeStats([1, 2]), {});
});

test('stats round-trip through the storage helper', () => {
  const backend = memoryBackend();
  const store = createStorage(() => backend);
  assert.deepEqual(loadStats(store), {});
  const stats = recordGame(recordGame({}, 'guess', 4, 6), 'solve', 3, 5);
  assert.equal(saveStats(stats, store), true);
  assert.ok(backend.items.has('bulls-and-cows:stats'));
  assert.deepEqual(loadStats(store), stats);

  const blocked = createStorage(() => throwingBackend);
  assert.equal(saveStats(stats, blocked), false);
  assert.deepEqual(loadStats(blocked), {});
});
