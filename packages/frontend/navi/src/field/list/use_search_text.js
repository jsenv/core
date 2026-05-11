import { useMemo } from "preact/hooks";
import { applySearch } from "./apply_search.js";

/**
 * useSearch — reorders items so matched ones come first (sorted by score desc),
 * followed by non-matched items in their natural order. No item is hidden.
 * Returns [orderedItems, getItemMatchInfo].
 *   - orderedItems: all items, reordered
 *   - getItemMatchInfo(item): { match, score, ranges }
 *
 * When searchText is empty, natural order is preserved and all items match with score 0.
 *
 * To filter (hide non-matching items), pass filtered={!getItemMatchInfo(item).match}
 * to each ListItem. The list's matchFallback will be shown when all items are hidden.
 */
export const useSearchText = (searchText, items, matchFn = applySearch) => {
  if (typeof searchText !== "string") {
    throw new TypeError("useSearchText: searchText must be a string");
  }
  if (items === undefined) {
    throw new TypeError("useSearch: items is undefined");
  }
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
