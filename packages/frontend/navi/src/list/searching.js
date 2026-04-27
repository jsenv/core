/**
 * applySearchText — returns truthy when value matches searchText, falsy otherwise.
 * Use with ListItem to drive hidden and highlight props explicitly:
 *
 *   const match = applySearchText(item.value, searchText);
 *   <ListItem hidden={!match} highlight={match ? searchText : null}>
 *
 * Returns true (no filtering) when searchText is empty/null.
 */
export const applySearchText = (value, searchText) => {
  if (!searchText) {
    return true;
  }
  return String(value).toLowerCase().includes(searchText.toLowerCase());
};
