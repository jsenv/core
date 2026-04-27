/**
 * applySearchText — matches value against searchText.
 * Returns a match object { ranges } when value matches, or null when it does not.
 * Returns { ranges: [] } (no highlight, visible) when searchText is empty/null.
 *
 * Use with ListItem to drive hidden and highlight props explicitly:
 *
 *   const match = applySearchText(searchText, item.value);
 *   <ListItem hidden={!match} highlight={match?.ranges}>
 *
 * The ranges array contains [start, end] pairs (exclusive end) indicating
 * which character positions in value are matching. ListItem uses these to
 * highlight the corresponding text in the DOM via the CSS Highlight API.
 */
export const applySearchText = (searchText, value) => {
  if (!searchText) {
    return { ranges: [] };
  }
  const str = String(value);
  const lowerStr = str.toLowerCase();
  const lowerSearch = searchText.toLowerCase();
  const ranges = [];
  let idx = lowerStr.indexOf(lowerSearch);
  while (idx !== -1) {
    ranges.push([idx, idx + searchText.length]);
    idx = lowerStr.indexOf(lowerSearch, idx + 1);
  }
  if (ranges.length === 0) {
    return null;
  }
  return { ranges };
};
