import { applySearch } from "./apply_search.js";

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
