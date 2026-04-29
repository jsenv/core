/**
 * applySearch — matches value against searchText.
 *
 * Accent-insensitive: "gue" matches "Guérin", "e" matches "é".
 * Case-insensitive: "bob" matches "Bob", with a +0.125 score bonus for case-exact matches.
 *
 * Multi-word: if searchText contains spaces, each word must appear somewhere in
 * the value for it to match. Ranges for all words are returned.
 *
 * Score (before case bonus):
 *   1    — value starts with the full searchText phrase
 *   0.75 — all words match and one of them is at the start
 *   0.5  — all words / phrase match somewhere (contains)
 * +0.125 bonus when the match is also case-exact.
 *
 * - matchRanges: [start, end] pairs (exclusive end) for CSS Highlight API
 *
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
    const caseExact = str.includes(searchText);
    const matchScore = (atStart ? 1 : 0.5) + (caseExact ? 0.125 : 0);
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
  const matchScore =
    (anyWordAtStart ? 0.75 : 0.5) + (allWordsExact ? 0.125 : 0);
  return { match: true, matchScore, matchRanges };
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
