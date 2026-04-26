import {
  List,
  ListItem,
  ListboxIdContext,
  SetSearchTextContext,
} from "./list.jsx";

export { ListboxIdContext, SetSearchTextContext };

/**
 * SuggestionList — a keyboard-navigable, filterable listbox.
 *
 * Props:
 *   uiAction    — called with the selected value when the user confirms a suggestion
 *   fallback    — content shown when no suggestions are visible (default: "No results")
 *   popover     — when true, renders as a managed popover (positioned near an anchor)
 *
 *   withSearch  — when true, the list owns its search text state internally. An <Input>
 *                 placed anywhere inside (e.g. in a <ListItemHeader>) auto-connects
 *                 to the search via SetSearchTextContext. Each <Suggestion> is
 *                 automatically hidden when it doesn't match the search text.
 *   match       — custom match function (value, lowerCaseSearchText) => boolean.
 *                 Only used when withSearch is true. Default: substring match.
 *   searchText  — external search string. Use when you manage the search state
 *                 yourself (without withSearch). Suggestions whose value does not
 *                 match are hidden and matching text is highlighted.
 *
 *   lockSize    — when true, captures the list container's dimensions the first
 *                 time it renders (always in unfiltered state, even if a filter is
 *                 already active on mount). Those captured dimensions become
 *                 min-width/min-height so that subsequent filtering never collapses
 *                 the layout. The size is captured once per mount. Defaults to true
 *                 when the list is inside a <Dropdown>.
 *
 *   renderBudget — max items kept in the DOM at once (virtual scroll). Default 100.
 *   ...rest      — forwarded to the underlying <ul> element.
 */
export const SuggestionList = (props) => {
  return (
    <List
      keyboardInteractions={true}
      listRole="listbox"
      fallback="No results"
      {...props}
    />
  );
};

/**
 * Suggestion — a selectable option inside SuggestionList.
 *
 * Thin wrapper over <ListItem> that adds role="option" and ARIA attributes.
 * Search-based hiding and text highlighting are handled by <ListItem>.
 */
export const Suggestion = ({ value, hidden, selected, children, ...rest }) => {
  return (
    <ListItem
      role="option"
      hidden={hidden}
      id={value}
      value={value}
      selected={selected}
      baseClassName="navi_list_item navi_suggestion"
      {...rest}
    >
      {children}
    </ListItem>
  );
};
