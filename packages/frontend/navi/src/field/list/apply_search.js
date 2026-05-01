/**
 * applySearch — matches value against searchText.
 *
 * Accent-insensitive: "gue" matches "Guérin", "e" matches "é".
 * Case-insensitive: "bob" matches "Bob", with a score bonus for case-exact matches.
 * Multi-word: if searchText contains spaces, each word must appear somewhere in
 * the value for it to match. Ranges for all words are returned.
 *
 * Score table:
 *
 *   Situation                                Score
 *   ───────────────────────────────────────  ───────────────────────────
 *   phrase at start of value                 1
 *   multi-word, one word at start (all match)  0.75
 *   phrase / word at word boundary           0.625
 *   phrase / words mid-word                  0.5
 *   + case-exact bonus                       +0.125
 *   multi-word partial: score × (matched/total)
 *
 * matchRanges: [start, end] pairs (exclusive end) for CSS Highlight API.
 * Intended to be passed to useSearch as the matchFn parameter.
 */
export const applySearch = (searchText, value) => {
  if (!searchText) {
    return { match: true, matchScore: 0, matchRanges: [] };
  }
  if (searchText.length > 100) {
    searchText = searchText.slice(0, 100);
  }
  const str = String(value);
  const foldedStr = foldAccents(str).toLowerCase();
  const { foldedSearch, words, originalWords } = getSearchInfo(searchText);

  // Try exact phrase match first (gives best score).
  const phraseRanges = [];
  let phraseIdx = foldedStr.indexOf(foldedSearch);
  while (phraseIdx !== -1) {
    phraseRanges.push([phraseIdx, phraseIdx + foldedSearch.length]);
    phraseIdx = foldedStr.indexOf(foldedSearch, phraseIdx + 1);
  }
  if (phraseRanges.length > 0) {
    const atStart = foldedStr.startsWith(foldedSearch);
    const atWordBoundary = phraseRanges.some(([start]) =>
      isWordBoundary(foldedStr, start),
    );
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
    return { match: true, matchScore, matchRanges: mergeRanges(phraseRanges) };
  }

  // Multi-word OR: split on whitespace, any word matching contributes to the score.
  // Items where all words match rank higher than partial matches.
  if (words.length < 2) {
    return { match: false, matchScore: 0, matchRanges: [] };
  }
  const matchRanges = [];
  let matchedWordCount = 0;
  let anyWordAtStart = false;
  let anyWordAtWordBoundary = false;
  let allMatchedWordsExact = true;
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    const originalWord = originalWords[w];
    let idx = foldedStr.indexOf(word);
    if (idx === -1) {
      continue;
    }
    matchedWordCount++;
    let wordHasExactMatch = false;
    while (idx !== -1) {
      matchRanges.push([idx, idx + word.length]);
      if (idx === 0) {
        anyWordAtStart = true;
        anyWordAtWordBoundary = true;
      } else if (isWordBoundary(foldedStr, idx)) {
        anyWordAtWordBoundary = true;
      }
      if (str.slice(idx, idx + word.length) === originalWord) {
        wordHasExactMatch = true;
      }
      idx = foldedStr.indexOf(word, idx + 1);
    }
    if (!wordHasExactMatch) {
      allMatchedWordsExact = false;
    }
  }
  if (matchedWordCount === 0) {
    return { match: false, matchScore: 0, matchRanges: [] };
  }
  const wordRatio = matchedWordCount / words.length;
  let baseScore;
  if (anyWordAtStart) {
    baseScore = SCORE_MULTI_WORD_AT_START;
  } else if (anyWordAtWordBoundary) {
    baseScore = SCORE_AT_WORD_BOUNDARY;
  } else {
    baseScore = SCORE_MID_WORD;
  }
  const matchScore =
    (baseScore + (allMatchedWordsExact ? SCORE_BONUS_CASE_EXACT : 0)) *
    wordRatio;
  return { match: true, matchScore, matchRanges: mergeRanges(matchRanges) };
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

// Strip diacritics for accent-insensitive matching.
// NFC normalization first ensures precomposed characters (é → single code unit),
// so the folded string has the same length as the NFC source — ranges computed
// on the folded string map 1:1 to positions in the original string.
const foldAccents = (str) => {
  return str
    .normalize("NFC")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "");
};

const SCORE_PHRASE_AT_START = 1;
const SCORE_MULTI_WORD_AT_START = 0.75;
const SCORE_AT_WORD_BOUNDARY = 0.625;
const SCORE_MID_WORD = 0.5;
const SCORE_BONUS_CASE_EXACT = 0.125;

// LRU cache for pre-computed search info, avoids recomputing foldAccents/toLowerCase
// for the same searchText across all items in a list render.
const searchCache = new Map();
const SEARCH_CACHE_MAX_SIZE = 20;
const getSearchInfo = (searchText) => {
  if (searchCache.has(searchText)) {
    const cached = searchCache.get(searchText);
    searchCache.delete(searchText);
    searchCache.set(searchText, cached);
    return cached;
  }
  const foldedSearch = foldAccents(searchText).toLowerCase();
  const words = foldedSearch.split(/\s+/).filter(Boolean);
  const originalWords = searchText.split(/\s+/).filter(Boolean);
  const info = { foldedSearch, words, originalWords };
  searchCache.set(searchText, info);
  if (searchCache.size > SEARCH_CACHE_MAX_SIZE) {
    searchCache.delete(searchCache.keys().next().value);
  }
  return info;
};

// Merge overlapping or adjacent [start, end] ranges (sorted by start).
const mergeRanges = (ranges) => {
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
