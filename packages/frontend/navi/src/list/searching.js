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
    const map = new Map();
    const infos = items.map((item, naturalIndex) => {
      const result = matchFn(searchText, item);
      return {
        item,
        naturalIndex,
        match: result.match,
        score: result.matchScore,
        ranges: result.matchRanges,
      };
    });

    // Stable sort: matched items by score desc, then non-matched in natural order.
    // Array.sort is stable in JS (ES2019+), so equal scores preserve naturalIndex order.
    const matched = infos.filter((info) => info.match);
    matched.sort((a, b) => b.score - a.score);
    const nonMatched = infos.filter((info) => !info.match);

    const ordered = [...matched, ...nonMatched];
    for (let order = 0; order < ordered.length; order++) {
      const info = ordered[order];
      map.set(info.item, {
        match: info.match,
        score: info.score,
        order,
        ranges: info.ranges,
      });
    }

    return map;
  }, [items, searchText, matchFn]);

  const getItemMatchInfo = (item) => {
    return matchInfoMap.get(item);
  };

  return [getItemMatchInfo];
};
