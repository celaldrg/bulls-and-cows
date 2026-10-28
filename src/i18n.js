/**
 * English and Turkish UI strings plus small formatting helpers.
 * Pure module (no DOM, no storage) so tests can check that both languages
 * define the same keys and placeholders.
 *
 * A string may contain {name} placeholders. A plural string is an object
 * keyed by Intl.PluralRules categories ('one', 'other') and is chosen by
 * the `n` parameter.
 */

/** Supported languages; the first one is the default. */
export const LANGUAGES = Object.freeze(['en', 'tr']);

/** @typedef {string|Readonly<Record<string, string>>} Entry */

/** @type {Readonly<Record<string, Readonly<Record<string, Entry>>>>} */
export const STRINGS = Object.freeze({
  en: Object.freeze({
    docTitle: 'Bulls and Cows',
    title: 'Bulls and Cows',
    newGame: 'New game',
    langButton: 'TR',
    langSwitch: 'Switch to Turkish',
    modes: 'Game mode',
    tabGuess: 'You guess',
    tabSolve: 'Computer guesses',
    boardGuess: 'Your guesses',
    boardSolve: "Computer's guesses",
    legendBull: 'Bull',
    legendCow: 'Cow',
    emptyGuess:
      'No guesses yet. Type a number with {n} different digits. A bull is a right digit in the right place, a cow is a right digit in the wrong place.',
    emptySolve: 'My guesses and your answers will appear here.',
    rowLabel: 'Guess {i}: {code}. Bulls: {b}, cows: {c}.',
    countBulls: '{n}B',
    countCows: '{n}C',
    conflictFlag: 'Clashes with your answer',
    notesTitle: 'Notes',
    notesHint: 'Tap a digit: excluded → confirmed → clear',
    markExcluded: 'excluded',
    markConfirmed: 'confirmed',
    digitMark: '{d}, {mark}',
    keypad: 'Keypad',
    slotsLabel: 'Your guess: {code}',
    slotsEmpty: 'Your guess: empty',
    keyDelete: 'Delete digit',
    keyGuess: 'Guess',
    keysGuess: 'Keys: 0–9 type, Backspace deletes, Enter guesses, Shift + digit marks a note.',
    keysSolve: 'Keys: B / C add a bull / cow (with Shift: remove one), Enter answers, Backspace undoes.',
    errLength: 'Enter {n} digits first.',
    errRepeated: 'You already tried {code}.',
    errDistinct: 'Each digit can be used only once.',
    errLeadingZero: "The first digit can't be 0 with these settings.",
    errFull: 'All digits are in: press Enter to guess.',
    errOver: 'This game is over. Start a new one.',
    resultGuess: '{code}: bulls {b}, cows {c}',
    solveTitle: 'My guess #{n}',
    solveIntro: 'Think of a secret number with {n} different digits. {zero} Then answer each of my guesses with bulls and cows.',
    zeroAllowed: 'It may start with 0.',
    zeroBanned: "It can't start with 0.",
    guessLabel: 'My guess: {code}',
    thinking: 'Thinking…',
    remaining: { one: '1 possible number left', other: '{n} possible numbers left' },
    bulls: 'Bulls',
    cows: 'Cows',
    moreBulls: 'Add a bull',
    fewerBulls: 'Remove a bull',
    moreCows: 'Add a cow',
    fewerCows: 'Remove a cow',
    answer: 'Answer',
    undo: 'Undo',
    answerText: '{b}B {c}C',
    impossible: "{answer} can't happen: with {b} bulls the last digit would be a bull too.",
    conflict: '{answer} clashes with {list}: no number fits all your answers. Check them, or undo.',
    guessRef: '#{n}',
    resultSolve: 'My next guess: {code}',
    winGuessTitle: 'You cracked it!',
    winGuessText: {
      one: 'The secret was {code}. You needed just 1 guess.',
      other: 'The secret was {code}. You needed {n} guesses.',
    },
    winSolveTitle: 'Got it!',
    winSolveText: {
      one: 'Your number is {code}. I needed just 1 guess.',
      other: 'Your number is {code}. I needed {n} guesses.',
    },
    playAgain: 'Play again',
    close: 'Close',
    settingsTitle: 'Settings',
    digitsLabel: 'Digits',
    leadingZeroLabel: 'Can start with 0',
    levelLabel: 'Computer level',
    levelHard: 'Hard',
    levelEasy: 'Easy',
    settingsNote: 'Changing a setting starts a new game.',
    statsTitle: 'Statistics',
    statsScope: '{mode}, {n} digits',
    statsGames: 'Games',
    statsAverage: 'Average',
    statsBest: 'Best',
    footer: 'MIT · Source on GitHub',
  }),
  tr: Object.freeze({
    docTitle: 'Sayı Bulmaca · Bulls and Cows',
    title: 'Sayı Bulmaca',
    newGame: 'Yeni oyun',
    langButton: 'EN',
    langSwitch: 'İngilizceye geç',
    modes: 'Oyun modu',
    tabGuess: 'Sen bul',
    tabSolve: 'Bilgisayar bulsun',
    boardGuess: 'Tahminlerin',
    boardSolve: 'Bilgisayarın tahminleri',
    legendBull: 'Boğa (+)',
    legendCow: 'İnek (−)',
    emptyGuess:
      'Henüz tahmin yok. Rakamları farklı {n} basamaklı bir sayı yaz. Boğa doğru yerdeki doğru rakam, inek yanlış yerdeki doğru rakamdır.',
    emptySolve: 'Tahminlerim ve cevapların burada görünecek.',
    rowLabel: 'Tahmin {i}: {code}. Boğa: {b}, inek: {c}.',
    countBulls: '+{n}',
    countCows: '−{n}',
    conflictFlag: 'Cevabınla çelişiyor',
    notesTitle: 'Notlar',
    notesHint: 'Rakama dokun: elendi → kesin → temiz',
    markExcluded: 'elendi',
    markConfirmed: 'kesin',
    digitMark: '{d}, {mark}',
    keypad: 'Tuş takımı',
    slotsLabel: 'Tahminin: {code}',
    slotsEmpty: 'Tahminin: boş',
    keyDelete: 'Rakamı sil',
    keyGuess: 'Tahmin et',
    keysGuess: 'Tuşlar: 0–9 yazar, Backspace siler, Enter tahmin eder, Shift + rakam not koyar.',
    keysSolve: 'Tuşlar: B / İ boğa / inek ekler (Shift ile azaltır), Enter cevaplar, Backspace geri alır.',
    errLength: 'Önce {n} rakam gir.',
    errRepeated: 'Bu sayıyı zaten denedin: {code}',
    errDistinct: 'Her rakam yalnız bir kez kullanılabilir.',
    errLeadingZero: 'Bu ayarlarda ilk rakam 0 olamaz.',
    errFull: 'Rakamlar tamam: tahmin için Enter tuşuna bas.',
    errOver: 'Bu oyun bitti. Yeni bir oyun başlat.',
    resultGuess: '{code}: boğa {b}, inek {c}',
    solveTitle: '{n}. tahminim',
    solveIntro: 'Rakamları farklı {n} basamaklı gizli bir sayı tut. {zero} Sonra her tahminime boğa ve inek sayısıyla cevap ver.',
    zeroAllowed: '0 ile başlayabilir.',
    zeroBanned: '0 ile başlayamaz.',
    guessLabel: 'Tahminim: {code}',
    thinking: 'Düşünüyorum…',
    remaining: '{n} olası sayı kaldı',
    bulls: 'Boğa (+)',
    cows: 'İnek (−)',
    moreBulls: 'Boğa ekle',
    fewerBulls: 'Boğa çıkar',
    moreCows: 'İnek ekle',
    fewerCows: 'İnek çıkar',
    answer: 'Cevapla',
    undo: 'Geri al',
    answerText: '+{b} −{c}',
    impossible: '{answer} olamaz: {b} boğa varsa son rakam da boğa olur.',
    conflict: '{answer} cevabı {list} ile çelişiyor: hiçbir sayı tüm cevaplarına uymuyor. Kontrol et ya da geri al.',
    guessRef: '#{n}',
    resultSolve: 'Sıradaki tahminim: {code}',
    winGuessTitle: 'Buldun!',
    winGuessText: 'Gizli sayı {code} idi. {n} tahminde buldun.',
    winSolveTitle: 'Buldum!',
    winSolveText: 'Tuttuğun sayı {code}. {n} tahminde buldum.',
    playAgain: 'Yeniden oyna',
    close: 'Kapat',
    settingsTitle: 'Ayarlar',
    digitsLabel: 'Basamak',
    leadingZeroLabel: '0 ile başlayabilir',
    levelLabel: 'Bilgisayar seviyesi',
    levelHard: 'Zor',
    levelEasy: 'Kolay',
    settingsNote: 'Bir ayar değişince yeni oyun başlar.',
    statsTitle: 'İstatistikler',
    statsScope: '{mode}, {n} basamak',
    statsGames: 'Oyun',
    statsAverage: 'Ortalama',
    statsBest: 'En iyi',
    footer: "MIT · Kaynak kodu GitHub'da",
  }),
});

/**
 * Turns a stored or requested value into a supported language.
 * @param {unknown} raw
 * @returns {string} One of LANGUAGES (the default for anything unknown).
 */
export function normalizeLanguage(raw) {
  return typeof raw === 'string' && LANGUAGES.includes(raw) ? raw : LANGUAGES[0];
}

/**
 * The language the toggle switches to.
 * @param {string} lang
 * @returns {string}
 */
export function nextLanguage(lang) {
  const index = LANGUAGES.indexOf(normalizeLanguage(lang));
  return LANGUAGES[(index + 1) % LANGUAGES.length];
}

/** @type {Map<string, Intl.NumberFormat>} */
const numberFormats = new Map();

/**
 * Formats a number for a language ("5,040" in English, "5.040" in Turkish).
 * @param {string} lang
 * @param {number} value
 * @param {number} [fractionDigits] Maximum digits after the decimal point.
 * @returns {string}
 */
export function formatNumber(lang, value, fractionDigits = 1) {
  const key = `${lang}:${fractionDigits}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(lang, { maximumFractionDigits: fractionDigits });
    numberFormats.set(key, format);
  }
  return format.format(value);
}

/**
 * Joins items into a sentence list ("#1, #2 and #4" / "#1, #2 ve #4").
 * @param {string} lang
 * @param {readonly string[]} items
 * @returns {string}
 */
export function formatList(lang, items) {
  return new Intl.ListFormat(lang, { type: 'conjunction' }).format(items);
}

/**
 * Looks up a string and fills in its placeholders. Numbers are formatted
 * for the language; unknown keys come back unchanged.
 * @param {string} lang
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function translate(lang, key, params = {}) {
  const language = normalizeLanguage(lang);
  const entry = STRINGS[language][key] ?? STRINGS[LANGUAGES[0]][key];
  if (entry === undefined) return key;
  const template = typeof entry === 'string' ? entry : pluralForm(language, entry, params.n);
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (!(name in params)) return match;
    const value = params[name];
    return typeof value === 'number' ? formatNumber(language, value) : String(value);
  });
}

/**
 * @param {string} lang
 * @param {Readonly<Record<string, string>>} forms
 * @param {unknown} n
 * @returns {string}
 */
function pluralForm(lang, forms, n) {
  const category = new Intl.PluralRules(lang).select(typeof n === 'number' ? n : 0);
  return forms[category] ?? forms.other;
}
