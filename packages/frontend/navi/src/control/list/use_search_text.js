import { useCallback, useMemo } from "preact/hooks";
import { applySearch } from "./apply_search.js";

/**
 * useSearchText — reorders items so matched ones come first (sorted by score
 * desc), followed by non-matched items in their natural order. No item is
 * dropped: what a non-matching row becomes is the list's `searchNoMatchMode`.
 * Returns [orderedItems, getItemMatchInfo].
 *   - orderedItems: all items, reordered
 *   - getItemMatchInfo(item): { match, matchScore, matchRanges } — pass the
 *     whole thing straight to <List.Item matchInfo={getItemMatchInfo(item)} />,
 *     there is no need to destructure the three fields by hand. The row derives
 *     filtered / hidden / muted from it, and the list counts the rows matching
 *     nothing (its searchFallback shows when none matches).
 *
 * When searchText is empty, natural order is preserved and all items match with
 * score 0.
 *
 * Rows declared one by one (<List.Item> children) give their place back when
 * removed. A run (<List.Items items={...}>) does not: it keeps the room of
 * every item it was given, drawn or held in a filler. In "remove" mode, hand
 * the run the matching items only — the ones whose getItemMatchInfo(item).match
 * is not false; a typed search that leaves the list without a row still shows
 * its searchFallback.
 */
export const useSearchText = (searchText, items, matchFn = applySearch) => {
  if (typeof searchText !== "string" && searchText !== undefined) {
    throw new TypeError(
      "useSearchText: searchText must be a string or undefined",
    );
  }
  if (items === undefined) {
    throw new TypeError("useSearchText: items is undefined");
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

  // The same function for as long as the map is the same: a `renderItem`
  // reading it is stable only if this is, and a run keeps the rows it drew
  // only for a stable `renderItem` (see List.Items).
  const getItemMatchInfo = useCallback(
    (item) => matchInfoMap.get(item),
    [matchInfoMap],
  );

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
        matchScore: result.matchScore,
        matchRanges: result.matchRanges,
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
      scoreEntries[lo][1].push({ item, matchRanges: result.matchRanges });
    } else {
      scoreEntries.splice(lo, 0, [
        score,
        [{ item, matchRanges: result.matchRanges }],
      ]);
    }
  }

  const matchInfoMap = new Map();
  for (const [score, bucket] of scoreEntries) {
    for (const { item, matchRanges } of bucket) {
      matchInfoMap.set(item, { match: true, matchScore: score, matchRanges });
    }
  }
  for (const { item, matchScore, matchRanges } of nonMatched) {
    matchInfoMap.set(item, { match: false, matchScore, matchRanges });
  }

  return { scoreEntries, nonMatched, matchInfoMap };
};
