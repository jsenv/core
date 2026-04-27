import { useMemo } from "preact/hooks";

/**
 * applySearch — matches value against searchText.
 * Returns { match, matchScore, matchRanges }:
 *   - match: true when value contains searchText (or searchText is empty), false otherwise
 *   - matchScore: 0 to 1 match quality:
 *       0   — no searchText or no match
 *       0.5 — searchText found somewhere in value (contains)
 *       1   — value starts with searchText (highest priority)
 *   - matchRanges: [start, end] pairs (exclusive end) for CSS Highlight API
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
  const matchRanges = [];
  let idx = lowerStr.indexOf(lowerSearch);
  while (idx !== -1) {
    matchRanges.push([idx, idx + searchText.length]);
    idx = lowerStr.indexOf(lowerSearch, idx + 1);
  }
  if (matchRanges.length === 0) {
    return { match: false, matchScore: 0, matchRanges: [] };
  }
  const matchScore = lowerStr.startsWith(lowerSearch) ? 1 : 0.5;
  return { match: true, matchScore, matchRanges };
};

/**
 * useSearch — applies matchFn to each item and assigns a stable ordering.
 * Returns [getItemMatchInfo] where getItemMatchInfo(item) returns { match, score, order, ranges }.
 *   - match: whether the item matches the search
 *   - score: 0 to 1 match quality
 *   - order: integer index for sorting in the UI (matched items first, sorted by score desc)
 *   - ranges: [start, end] pairs for highlight
 *
 * When scores are equal, natural order of items is preserved (stable sort).
 * When searchText is empty, all items match with score 0 (natural order preserved).
 *
 * Usage:
 *   const [getItemMatchInfo] = useSearchText(items, searchText, applySearchText);
 *   // in render loop:
 *   const { match, score, order, ranges } = getItemMatchInfo(item);
 *   <ListItem hidden={!match} highlight={ranges} />
 */
export const useSearch = (searchText, items, matchFn = applySearch) => {
  const matchInfoMap = useMemo(() => {
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

    const map = new Map();
    let order = 0;
    for (const [score, bucket] of scoreEntries) {
      for (const info of bucket) {
        map.set(info.item, { match: true, score, order, ranges: info.ranges });
        order++;
      }
    }
    for (const info of nonMatched) {
      map.set(info.item, {
        match: false,
        score: info.score,
        order,
        ranges: info.ranges,
      });
      order++;
    }
    return map;
  }, [items, searchText, matchFn]);

  const getItemMatchInfo = (item) => {
    return matchInfoMap.get(item);
  };

  return [getItemMatchInfo];
};
