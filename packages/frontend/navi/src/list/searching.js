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
    // Single pass: separate matched vs non-matched, inserting matched items
    // in score-desc order via binary search (bisect) to avoid a separate sort step.
    // Non-matched items accumulate in natural order at the end.
    const matched = []; // sorted desc by score as we build it
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
      // Binary search for insertion point (desc order: higher score first).
      // Equal scores go at the end of their group (preserves natural order).
      const score = result.matchScore;
      let lo = 0;
      let hi = matched.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (matched[mid].score > score) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      matched.splice(lo, 0, { item, score, ranges: result.matchRanges });
    }

    const map = new Map();
    let order = 0;
    for (const info of matched) {
      map.set(info.item, {
        match: true,
        score: info.score,
        order,
        ranges: info.ranges,
      });
      order++;
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
