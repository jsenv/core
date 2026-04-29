import { useMemo } from "preact/hooks";

/**
 * useSearch — reorders items so matched ones come first (sorted by score desc),
 * followed by non-matched items in their natural order. No item is hidden.
 * Returns [orderedItems, getItemMatchInfo].
 *   - orderedItems: all items, reordered
 *   - getItemMatchInfo(item): { match, score, ranges }
 *
 * When searchText is empty, natural order is preserved and all items match with score 0.
 *
 * To filter (hide non-matching items), pass hidden={!getItemMatchInfo(item).match}
 * to each ListItem. The list's matchFallback will be shown when all items are hidden.
 */
export const useSearch = (searchText, items, matchFn = applySearch) => {
  const { orderedItems, matchInfoMap } = useMemo(() => {
    const { scoreEntries, nonMatched, matchInfoMap } = buildMatchInfo(
      searchText,
      items,
      matchFn,
    );
    const orderedItems = [];
    for (const [, bucket] of scoreEntries) {
      for (const { item } of bucket) {
        orderedItems.push(item);
      }
    }
    for (const { item } of nonMatched) {
      orderedItems.push(item);
    }
    return { orderedItems, matchInfoMap };
  }, [items, searchText, matchFn]);

  const getItemMatchInfo = (item) => {
    return matchInfoMap.get(item);
  };

  return [orderedItems, getItemMatchInfo];
};

const buildMatchInfo = (searchText, items, matchFn) => {
  // scoreEntries: [score, bucket][] kept sorted desc by score.
  // New distinct score values are inserted via bisect — O(1) in practice
  // since there are very few distinct scores (today just 0 and 1).
  const scoreEntries = []; // [score, bucket][]
  const nonMatched = [];

  for (const item of items) {
    const result = matchFn(searchText, item);
    if (!result.match) {
      nonMatched.push({
        item,
        score: result.matchScore,
        ranges: result.matchRanges,
      });
      continue;
    }
    const score = result.matchScore;
    // Find existing bucket or insert a new entry in desc order.
    let lo = 0;
    let hi = scoreEntries.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (scoreEntries[mid][0] > score) {
        lo = mid + 1;
      } else if (scoreEntries[mid][0] < score) {
        hi = mid;
      } else {
        lo = mid;
        hi = mid; // exact match — found the bucket
      }
    }
    if (lo < scoreEntries.length && scoreEntries[lo][0] === score) {
      scoreEntries[lo][1].push({ item, ranges: result.matchRanges });
    } else {
      scoreEntries.splice(lo, 0, [
        score,
        [{ item, ranges: result.matchRanges }],
      ]);
    }
  }

  const matchInfoMap = new Map();
  for (const [score, bucket] of scoreEntries) {
    for (const { item, ranges } of bucket) {
      matchInfoMap.set(item, { match: true, score, ranges });
    }
  }
  for (const { item, score, ranges } of nonMatched) {
    matchInfoMap.set(item, { match: false, score, ranges });
  }

  return { scoreEntries, nonMatched, matchInfoMap };
};

/**
 * createSearch — builds a matchFn compatible with useSearch that searches
 * across multiple named fields of an item, each with its own DOM selector
 * and optional priority weight.
 *
 * Usage:
 * ```js
 * const searchPerson = createSearch({
 *   name: {
 *     getter: (item) => item.name,
 *     domSelector: ".name",
 *   },
 *   address: {
 *     getter: (item) => item.address,
 *     domSelector: ".address",
 *     priority: 1.5,
 *   },
 * });
 *
 * const [orderedItems, getItemMatchInfo] = useSearch(search, items, searchPerson);
 * // getItemMatchInfo(item).matchRanges is { ".name": [[start,end],…], ".address": [[start,end],…] }
 * // Pass it to <ListItem highlight={matchRanges} /> — ListItem handles the object format.
 * ```
 *
 * Each field config:
 *   - getter(item): string — extracts the text to search
 *   - domSelector: string — CSS selector used by ListItem to find the target element
 *   - priority?: number — multiplier applied to the field's score (default 1)
 *   - matchFn?: function — custom match function (searchText, fieldValue) => { match, matchScore, matchRanges }
 *                          defaults to applySearch
 */
export const createSearch = (fields) => {
  return (searchText, item) => {
    if (!searchText) {
      return { match: true, matchScore: 0, matchRanges: {} };
    }
    let totalScore = 0;
    const matchRanges = {};
    for (const [
      ,
      { getter, domSelector, priority = 1, matchFn = applySearch },
    ] of Object.entries(fields)) {
      const fieldValue = getter(item);
      const result = matchFn(searchText, fieldValue);
      if (result.match && result.matchRanges.length > 0) {
        totalScore += result.matchScore * priority;
        matchRanges[domSelector] = result.matchRanges;
      }
    }
    if (totalScore === 0) {
      return { match: false, matchScore: 0, matchRanges: {} };
    }
    return { match: true, matchScore: totalScore, matchRanges };
  };
};

/**
 * applySearch — matches value against searchText.
 *
 * Multi-word: if searchText contains spaces, each word must appear somewhere in
 * the value for it to match. Ranges for all words are returned. Score:
 *   1   — value starts with the full searchText phrase
 *   0.75 — all words match and one of them is at the start
 *   0.5  — all words match somewhere (contains)
 *
 * Single-word (no spaces): same as before.
 *   1   — value starts with searchText
 *   0.5 — value contains searchText
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
  const lowerStr = str.toLowerCase();
  const lowerSearch = searchText.toLowerCase();

  // Try exact phrase match first (gives best score).
  const phraseRanges = [];
  let phraseIdx = lowerStr.indexOf(lowerSearch);
  while (phraseIdx !== -1) {
    phraseRanges.push([phraseIdx, phraseIdx + lowerSearch.length]);
    phraseIdx = lowerStr.indexOf(lowerSearch, phraseIdx + 1);
  }
  if (phraseRanges.length > 0) {
    const matchScore = lowerStr.startsWith(lowerSearch) ? 1 : 0.5;
    return { match: true, matchScore, matchRanges: phraseRanges };
  }

  // Multi-word: split on whitespace and require each word to be present.
  const words = lowerSearch.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { match: false, matchScore: 0, matchRanges: [] };
  }
  const matchRanges = [];
  let anyWordAtStart = false;
  for (const word of words) {
    const wordRanges = [];
    let idx = lowerStr.indexOf(word);
    if (idx === -1) {
      return { match: false, matchScore: 0, matchRanges: [] };
    }
    while (idx !== -1) {
      wordRanges.push([idx, idx + word.length]);
      if (idx === 0) {
        anyWordAtStart = true;
      }
      idx = lowerStr.indexOf(word, idx + 1);
    }
    for (const range of wordRanges) {
      matchRanges.push(range);
    }
  }
  const matchScore = anyWordAtStart ? 0.75 : 0.5;
  return { match: true, matchScore, matchRanges };
};
