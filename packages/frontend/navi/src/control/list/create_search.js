import {
  applySearchByWord,
  applySearchToFolded,
  foldForSearch,
  isNoSearch,
  mergeRanges,
  searchWordsOf,
} from "./apply_search.js";

/**
 * createSearch — builds a matchFn compatible with useSearchText that searches
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
 * const [orderedItems, getItemMatchInfo] = useSearchText(search, items, searchPerson);
 * // getItemMatchInfo(item).matchRanges is { ".name": [[start,end],…], ".address": [[start,end],…] }
 * // Pass the whole thing: <ListItem matchInfo={getItemMatchInfo(item)} />
 * // — ListItem handles the per-selector object format for matchRanges.
 * ```
 *
 * Each field config:
 *   - getter(item): string — extracts the text to search
 *   - domSelector?: string — CSS selector used by ListItem to find the target element.
 *                   Without it, the field is searched and scored but highlights
 *                   nothing: text the item doesn't write (an alias, a civil name
 *                   under a nickname, tags). One field per selector: the ranges
 *                   of two fields sharing one are offsets into two different
 *                   strings, so the last field wins.
 *   - priority?: number — multiplier applied to the field's score (default 1)
 *   - matchFn?: function — custom match function (searchText, fieldValue) => { match, matchScore, matchRanges }
 *                          defaults to applySearch
 *
 * Every word of the search must be found in the item, each in any of its
 * fields: "padel nice" finds the club named Padel in Nice, and a word found
 * nowhere leaves the item out — a word typed narrows the results, it never
 * widens them. A field holding the whole search counts its score in full; a
 * field holding some of the words counts the share it holds, so an item whose
 * name says it all ranks above one that gathers the words from here and there.
 * A custom matchFn is asked about the whole search, then about each word.
 *
 * Each item's values are folded for matching once (see foldForSearch), and
 * kept with the item for as long as it lives: a keystroke only pays for the
 * search. A value that changed is folded again.
 */
export const createSearch = (fields) => {
  const fieldEntries = Object.entries(fields);
  const foldingsByItem = new WeakMap();
  const foldingOf = (item, fieldName, value) => {
    if (item === null || typeof item !== "object") {
      return foldForSearch(value);
    }
    let foldings = foldingsByItem.get(item);
    if (!foldings) {
      foldings = new Map();
      foldingsByItem.set(item, foldings);
    }
    const source = String(value);
    let folding = foldings.get(fieldName);
    if (!folding || folding.source !== source) {
      folding = foldForSearch(source);
      foldings.set(fieldName, folding);
    }
    return folding;
  };

  return (searchText, item) => {
    if (isNoSearch(searchText)) {
      return { match: true, matchScore: 0, matchRanges: {} };
    }
    const { words, originalWords } = searchWordsOf(searchText);
    if (words.length === 0) {
      return { match: true, matchScore: 0, matchRanges: {} };
    }
    const wordFound = new Array(words.length).fill(false);
    let totalScore = 0;
    const matchRanges = {};
    for (const [
      fieldName,
      { getter, domSelector, priority = 1, matchFn },
    ] of fieldEntries) {
      const fieldValue = getter(item);
      let whole;
      let wordResults;
      if (matchFn) {
        whole = matchFn(searchText, fieldValue);
        wordResults =
          words.length > 1 && !(whole.match && whole.matchRanges.length > 0)
            ? originalWords.map((word) => matchFn(word, fieldValue))
            : null;
      } else {
        const folding = foldingOf(item, fieldName, fieldValue);
        if (words.length > 1) {
          const searched = applySearchByWord(searchText, folding);
          whole = searched.result;
          wordResults = searched.wordResults;
        } else {
          whole = applySearchToFolded(searchText, folding);
          wordResults = null;
        }
      }
      if (whole.match && whole.matchRanges.length > 0) {
        totalScore += whole.matchScore * priority;
        if (domSelector) {
          matchRanges[domSelector] = whole.matchRanges;
        }
        wordFound.fill(true);
        continue;
      }
      if (words.length < 2 || !wordResults) {
        continue;
      }
      let fieldScore = 0;
      const fieldRanges = [];
      for (let w = 0; w < words.length; w++) {
        const result = wordResults[w];
        if (!result.match || result.matchRanges.length === 0) {
          continue;
        }
        wordFound[w] = true;
        fieldScore += result.matchScore;
        fieldRanges.push(...result.matchRanges);
      }
      if (fieldScore > 0) {
        totalScore += (fieldScore / words.length) * priority;
        if (domSelector) {
          matchRanges[domSelector] = mergeRanges(fieldRanges);
        }
      }
    }
    if (totalScore === 0 || wordFound.includes(false)) {
      return { match: false, matchScore: 0, matchRanges: {} };
    }
    return { match: true, matchScore: totalScore, matchRanges };
  };
};
