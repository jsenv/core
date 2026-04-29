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
 *   Situation                          Score
 *   ─────────────────────────────────  ─────
 *   phrase at start of value           1
 *   multi-word, one word at start      0.75
 *   phrase / word at word boundary     0.625
 *   phrase / words mid-word            0.5
 *   + case-exact bonus                 +0.125
 *
 * matchRanges: [start, end] pairs (exclusive end) for CSS Highlight API.
 * Intended to be passed to useSearch as the matchFn parameter.
 */
export const applySearch = (searchText, value) => {
  if (!searchText) {
    return { match: true, matchScore: 0, matchRanges: [] };
  }
  const str = String(value);
  const foldedStr = foldAccents(str).toLowerCase();
  const foldedSearch = foldAccents(searchText).toLowerCase();

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
    return { match: true, matchScore, matchRanges: phraseRanges };
  }

  // Multi-word: split on whitespace and require each word to be present.
  const words = foldedSearch.split(/\s+/).filter(Boolean);
  const originalWords = searchText.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { match: false, matchScore: 0, matchRanges: [] };
  }
  const matchRanges = [];
  let anyWordAtStart = false;
  let anyWordAtWordBoundary = false;
  let allWordsExact = true;
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    const originalWord = originalWords[w];
    const wordRanges = [];
    let idx = foldedStr.indexOf(word);
    if (idx === -1) {
      return { match: false, matchScore: 0, matchRanges: [] };
    }
    let wordHasExactMatch = false;
    while (idx !== -1) {
      wordRanges.push([idx, idx + word.length]);
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
      allWordsExact = false;
    }
    for (const range of wordRanges) {
      matchRanges.push(range);
    }
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
  return { match: true, matchScore, matchRanges };
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
