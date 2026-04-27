import { useMemo } from "preact/hooks";

/**
 * applySearchText — matches value against searchText.
 * Returns { match, matchScore, matchRanges }:
 *   - match: true when value contains searchText (or searchText is empty), false otherwise
 *   - matchScore: 0 to 1 (currently 0 = no searchText or no match, 1 = match found)
 *   - matchRanges: [start, end] pairs (exclusive end) for CSS Highlight API
 *
 * Intended to be passed to useSearchText as the matchFn parameter.
 */
export const applySearchText = (searchText, value) => {
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
  return { match: true, matchScore: 1, matchRanges };
};

/**
 * useSearchText — applies matchFn to each item and assigns a stable ordering.
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
export const useSearchText = (items, searchText, matchFn) => {
  const matchInfoMap = useMemo(() => {
    // Group matched items by score (O(1) push per item, no splice/shifting).
    // Non-matched items accumulate in natural order — their order is assigned
    // after all matched items, so we need matchedCount first anyway.
    const matchedByScore = new Map(); // score → { item, ranges }[]
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
      let bucket = matchedByScore.get(score);
      if (!bucket) {
        bucket = [];
        matchedByScore.set(score, bucket);
      }
      bucket.push({ item, ranges: result.matchRanges });
    }

    // Sort the few distinct score values desc. Natural order within each bucket
    // is preserved because items were pushed in iteration order.
    const sortedScores = [...matchedByScore.keys()].sort((a, b) => b - a);

    const map = new Map();
    let order = 0;
    for (const score of sortedScores) {
      for (const info of matchedByScore.get(score)) {
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
