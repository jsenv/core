/**
 * applySearch — matches value against searchText.
 *
 * Accent-insensitive: "gue" matches "Guérin", "e" matches "é".
 * Case-insensitive: "bob" matches "Bob", with a score bonus for case-exact matches.
 * Multi-word: every word of searchText must appear somewhere in the value, in
 * any order. A word typed narrows the results, it never widens them: "marie d"
 * keeps the Maries with a "d" somewhere, not every value holding a "d". The
 * whole phrase found as typed ranks first. An item searched over several
 * fields is createSearch's: there, each word may be found in a different field.
 * A searchText made of spaces only is no search: every value matches, with a
 * score of 0 and nothing to highlight.
 *
 * Score table:
 *
 *   Situation                                Score
 *   ───────────────────────────────────────  ───────────────────────────
 *   phrase at start of value                 1
 *   every word found, one of them at start   0.75
 *   phrase / words at word boundary          0.625
 *   phrase / words mid-word                  0.5
 *   acronym (2+ chars, each the first letter of a word, in order)  0.4, 0.45 at start
 *   + case-exact bonus                       +0.125
 *
 * matchRanges: [start, end] pairs (exclusive end) into value as it is given,
 * for the CSS Highlight API — whatever its normalization: a decomposed "é", a
 * Hangul syllable whose letters are matched one by one. The folding keeps where
 * each of its characters comes from (see foldForSearch).
 * Intended to be passed to useSearchText as the matchFn parameter.
 */
export const applySearch = (searchText, value) => {
  return applySearchToFolded(searchText, foldForSearch(value));
};

/**
 * applySearch on a value folded beforehand (see foldForSearch): what a caller
 * matching the same values at every keystroke keeps, so a keystroke only pays
 * for the search (see createSearch).
 */
export const applySearchToFolded = (searchText, folding) => {
  return searchFolded(searchText, folding, false).result;
};

/**
 * applySearchToFolded, and what each word of the search finds on its own: the
 * result applySearch would give that word alone, for each of `words` (the
 * search's words, folded, each once). What createSearch reads to find every
 * word in any of an item's fields, from one pass over each value.
 */
export const applySearchByWord = (searchText, folding) => {
  return searchFolded(searchText, folding, true);
};

/**
 * The words of a search, folded, each once, and as they were typed.
 */
export const searchWordsOf = (searchText) => {
  if (isNoSearch(searchText)) {
    return { words: [], originalWords: [] };
  }
  const { words, originalWords } = getSearchInfo(searchText.slice(0, 100));
  return { words, originalWords };
};

const NO_SEARCH = { words: [], wordResults: [] };
const noSearchResult = () => ({ match: true, matchScore: 0, matchRanges: [] });

const searchFolded = (searchText, folding, byWord) => {
  if (isNoSearch(searchText)) {
    return { result: noSearchResult(), ...NO_SEARCH };
  }
  if (searchText.length > 100) {
    searchText = searchText.slice(0, 100);
  }
  const { source: str, folded: foldedStr } = folding;
  const { foldedSearch, words, originalWords, initials, typedInitials } =
    getSearchInfo(searchText);
  if (words.length === 0) {
    // Nothing left once folded (accents typed on their own): no search either.
    return { result: noSearchResult(), ...NO_SEARCH };
  }

  // Try exact phrase match first (gives best score).
  let phraseResult = null;
  const phraseRanges = [];
  let atWordBoundary = false;
  let phraseIdx = foldedStr.indexOf(foldedSearch);
  while (phraseIdx !== -1) {
    phraseRanges.push(toSource(folding, phraseIdx, foldedSearch.length));
    if (isWordBoundary(foldedStr, phraseIdx)) {
      atWordBoundary = true;
    }
    phraseIdx = foldedStr.indexOf(foldedSearch, phraseIdx + 1);
  }
  if (phraseRanges.length > 0) {
    const atStart = foldedStr.startsWith(foldedSearch);
    const caseExact = str.includes(searchText);
    let baseScore;
    if (atStart) {
      baseScore = SCORE_PHRASE_AT_START;
    } else if (atWordBoundary) {
      baseScore = SCORE_AT_WORD_BOUNDARY;
    } else {
      baseScore = SCORE_MID_WORD;
    }
    const matchScore = baseScore + (caseExact ? SCORE_BONUS_CASE_EXACT : 0);
    phraseResult = {
      match: true,
      matchScore,
      matchRanges: mergeRanges(phraseRanges),
    };
    if (!byWord) {
      return { result: phraseResult, ...NO_SEARCH };
    }
  }

  // Every word, in any order: split on whitespace, and each word must be found.
  // This path also handles a searchText with leading or trailing spaces: the
  // phrase match above tries the literal (e.g. "tc " in "tc adapter"), and if
  // that fails each word is tried on its own (e.g. "tc" in "tca").
  const found = [];
  let allFound = true;
  for (let w = 0; w < words.length; w++) {
    const wordFound = findWord(folding, words[w], originalWords[w]);
    found.push(wordFound);
    if (!wordFound) {
      allFound = false;
      if (!byWord) {
        break;
      }
    }
  }
  let result;
  if (phraseResult) {
    result = phraseResult;
  } else if (allFound) {
    const matchRanges = [];
    let anyWordAtStart = false;
    let anyWordAtWordBoundary = false;
    let allWordsExact = true;
    for (const wordFound of found) {
      matchRanges.push(...wordFound.ranges);
      anyWordAtStart = anyWordAtStart || wordFound.atStart;
      anyWordAtWordBoundary = anyWordAtWordBoundary || wordFound.atWordBoundary;
      allWordsExact = allWordsExact && wordFound.exact;
    }
    let baseScore;
    if (anyWordAtStart) {
      baseScore = SCORE_MULTI_WORD_AT_START;
    } else if (anyWordAtWordBoundary) {
      baseScore = SCORE_AT_WORD_BOUNDARY;
    } else {
      baseScore = SCORE_MID_WORD;
    }
    const matchScore = baseScore + (allWordsExact ? SCORE_BONUS_CASE_EXACT : 0);
    result = { match: true, matchScore, matchRanges: mergeRanges(matchRanges) };
  } else {
    // A word missing: the value is not what was searched for, unless the
    // search reads as the initials of its words.
    result = tryAcronymMatch(folding, initials, typedInitials);
  }
  if (!byWord) {
    return { result, ...NO_SEARCH };
  }
  // What each word finds alone: where it was found, scored as a search for it
  // alone would be, and otherwise the initials it may stand for.
  const wordResults = found.map((wordFound, w) => {
    if (!wordFound) {
      return tryAcronymMatch(folding, words[w], originalWords[w]);
    }
    let baseScore;
    if (wordFound.atStart) {
      baseScore = SCORE_PHRASE_AT_START;
    } else if (wordFound.atWordBoundary) {
      baseScore = SCORE_AT_WORD_BOUNDARY;
    } else {
      baseScore = SCORE_MID_WORD;
    }
    return {
      match: true,
      matchScore: baseScore + (wordFound.exact ? SCORE_BONUS_CASE_EXACT : 0),
      matchRanges: mergeRanges(wordFound.ranges),
    };
  });
  return { result, words, wordResults };
};

// Where `word` stands in a folded value, every time, or null.
const findWord = (folding, word, originalWord) => {
  const { source, folded } = folding;
  let idx = folded.indexOf(word);
  if (idx === -1) {
    return null;
  }
  const ranges = [];
  let atStart = false;
  let atWordBoundary = false;
  let exact = false;
  while (idx !== -1) {
    const range = toSource(folding, idx, word.length);
    ranges.push(range);
    if (idx === 0) {
      atStart = true;
      atWordBoundary = true;
    } else if (isWordBoundary(folded, idx)) {
      atWordBoundary = true;
    }
    if (source.slice(range[0], range[1]) === originalWord) {
      exact = true;
    }
    idx = folded.indexOf(word, idx + 1);
  }
  return { ranges, atStart, atWordBoundary, exact };
};

// A range of the folded string, in the value's own positions.
const toSource = (folding, start, length) =>
  folding.starts
    ? [folding.starts[start], folding.ends[start + length - 1]]
    : [start, start + length];

// No text to look for: empty, or spaces only.
export const isNoSearch = (searchText) => {
  return !searchText || searchText.trim() === "";
};

// Returns true when position idx in str is at a word boundary,
// meaning it is either the start of the string or the preceding character
// is not a Unicode letter or digit.
const isWordBoundary = (str, idx) => {
  if (idx === 0) {
    return true;
  }
  return !/[\p{L}\p{N}]/u.test(str[idx - 1]);
};

/**
 * A value folded for matching — accents stripped, lower case — and, for each
 * character of the folded string, where it comes from in the value: its start,
 * and its end. Folding does not keep lengths. A decomposed "é" (two characters)
 * folds to one, a Hangul syllable to the two or three letters it is written
 * with, and a few letters lower to two; ranges found in the folded string are
 * given back in the value's own positions through these. `starts` and `ends`
 * are null when every character folds to one: the positions are then the
 * value's own.
 *
 * @param {any} value
 * @returns {{ source: string, folded: string, starts: number[]|null, ends: number[]|null }}
 */
export const foldForSearch = (value) => {
  const source = String(value);
  // One character for one, the case of almost every value: nothing folds away
  // (no mark of its own) and nothing grows (a Hangul syllable, a letter whose
  // lower case takes two), so the folded string has the value's length and
  // its positions are the value's own — no table to keep.
  const folded = source.normalize("NFD").replace(MARKS, "").toLowerCase();
  if (folded.length === source.length && !MARK.test(source)) {
    return { source, folded, starts: null, ends: null };
  }
  let foldedByChar = "";
  const starts = [];
  const ends = [];
  let index = 0;
  for (const char of source) {
    const foldedChar = foldChar(char);
    if (foldedChar === "" && ends.length > 0) {
      // A mark folded away (the accent of a decomposed "é") belongs to the
      // letter before it: a range ending on that letter takes it along.
      ends[ends.length - 1] = index + char.length;
    }
    for (let k = 0; k < foldedChar.length; k++) {
      starts.push(index);
      ends.push(index + char.length);
    }
    foldedByChar += foldedChar;
    index += char.length;
  }
  return { source, folded: foldedByChar, starts, ends };
};
const MARKS = /\p{Mn}/gu;
const MARK = /\p{Mn}/u;
const foldChar = (char) =>
  char.normalize("NFD").replace(MARKS, "").toLowerCase();
const foldText = (text) => {
  let folded = "";
  for (const char of text) {
    folded += foldChar(char);
  }
  return folded;
};

const SCORE_PHRASE_AT_START = 1;
const SCORE_MULTI_WORD_AT_START = 0.75;
const SCORE_AT_WORD_BOUNDARY = 0.625;
const SCORE_MID_WORD = 0.5;
const SCORE_ACRONYM = 0.4;
const SCORE_BONUS_CASE_EXACT = 0.125;

// Acronym match: each char of searchText (spaces stripped) must be the first
// letter of a word in value, in order (greedy subsequence on word-starts).
// e.g. "TC" matches "Total Count" highlighting the T and C.
// `acronymChars` is folded already, `originalAcronym` as typed (for the case
// bonus); neither holds spaces.
const tryAcronymMatch = (folding, acronymChars, originalAcronym) => {
  const { source: str, folded: foldedStr } = folding;
  if (acronymChars.length < 2) {
    // Single-char acronym is too ambiguous — skip.
    return { match: false, matchScore: 0, matchRanges: [] };
  }
  const wordStarts = wordStartsOf(folding);
  const matchedPositions = [];
  let wordIdx = 0;
  for (let si = 0; si < acronymChars.length; si++) {
    const ch = acronymChars[si];
    let found = false;
    while (wordIdx < wordStarts.length) {
      const pos = wordStarts[wordIdx];
      wordIdx++;
      if (foldedStr[pos] === ch) {
        matchedPositions.push(pos);
        found = true;
        break;
      }
    }
    if (!found) {
      return { match: false, matchScore: 0, matchRanges: [] };
    }
  }
  const atStart = matchedPositions[0] === 0;
  const caseExact = matchedPositions.every(
    (p, i) =>
      str[folding.starts ? folding.starts[p] : p] === originalAcronym[i],
  );
  const baseScore = atStart ? SCORE_ACRONYM + 0.05 : SCORE_ACRONYM;
  const matchScore = baseScore + (caseExact ? SCORE_BONUS_CASE_EXACT : 0);
  const matchRanges = matchedPositions.map((p) => toSource(folding, p, 1));
  return { match: true, matchScore, matchRanges };
};

// Where the words of a folded value start: read by every acronym attempt, and
// kept with the folding, which a caller may keep with its item.
const wordStartsOf = (folding) => {
  if (folding.wordStarts) {
    return folding.wordStarts;
  }
  const { folded } = folding;
  const wordStarts = [];
  for (let i = 0; i < folded.length; i++) {
    if (isWordBoundary(folded, i)) {
      wordStarts.push(i);
    }
  }
  folding.wordStarts = wordStarts;
  return wordStarts;
};

// LRU cache for pre-computed search info, avoids folding the same searchText
// again for every item of a list render.
const searchCache = new Map();
const SEARCH_CACHE_MAX_SIZE = 20;
const getSearchInfo = (searchText) => {
  if (searchCache.has(searchText)) {
    const cached = searchCache.get(searchText);
    searchCache.delete(searchText);
    searchCache.set(searchText, cached);
    return cached;
  }
  const foldedSearch = foldText(searchText);
  // Each word once: a word typed twice asks for nothing more.
  const words = [];
  const originalWords = [];
  const typedWords = searchText.split(/\s+/).filter(Boolean);
  const foldedWords = foldedSearch.split(/\s+/).filter(Boolean);
  for (let w = 0; w < foldedWords.length; w++) {
    if (!words.includes(foldedWords[w])) {
      words.push(foldedWords[w]);
      originalWords.push(typedWords[w]);
    }
  }
  const info = {
    foldedSearch,
    words,
    originalWords,
    // The search read as initials (see tryAcronymMatch).
    initials: foldedSearch.replace(/\s/g, ""),
    typedInitials: searchText.replace(/\s/g, ""),
  };
  searchCache.set(searchText, info);
  if (searchCache.size > SEARCH_CACHE_MAX_SIZE) {
    searchCache.delete(searchCache.keys().next().value);
  }
  return info;
};

// Merge overlapping or adjacent [start, end] ranges (sorted by start).
export const mergeRanges = (ranges) => {
  if (ranges.length < 2) {
    return ranges;
  }
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current[0] <= last[1]) {
      if (current[1] > last[1]) {
        last[1] = current[1];
      }
    } else {
      merged.push(current);
    }
  }
  return merged;
};
