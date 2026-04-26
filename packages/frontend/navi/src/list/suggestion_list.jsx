import { createContext } from "preact";
import {
  useContext,
  useId,
  useState,
} from "preact/hooks";

import { useIsInsideDropdown } from "./dropdown.jsx";
import { List, ListItem } from "./list.jsx";

export const SetSearchTextContext = createContext(null);
// Provided so the listbox uses the same stable id that the input's
// aria-controls points to.
export const ListboxIdContext = createContext(null);

const css = /* css */ `
  &[data-lock-sizing] {
    visibility: hidden;
  }
`;

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
export const SuggestionList = ({ popover, withSearch, match, ...rest }) => {
  import.meta.css = css;
  if (withSearch) {
    return (
      <SuggestionListWithSearch match={match} popover={popover} {...rest} />
    );
  }
  return <SuggestionListStandalone popover={popover} {...rest} />;
};

const defaultMatch = (v, searchText) =>
  String(v).toLowerCase().includes(searchText);

// Owns searchText state and provides SetSearchTextContext + ListboxIdContext.
// Passes searchText and match as props down to the inner SuggestionList.
const SuggestionListWithSearch = ({ match = defaultMatch, ...rest }) => {
  const [searchText, setSearchText] = useState("");
  const listboxId = useId();

  return (
    <SetSearchTextContext.Provider value={setSearchText}>
      <ListboxIdContext.Provider value={listboxId}>
        <SuggestionList
          {...rest}
          searchText={searchText}
          match={match}
          keyboardInteractions={false}
        />
      </ListboxIdContext.Provider>
    </SetSearchTextContext.Provider>
  );
};

// Standalone variant: attaches keyboard shortcuts to the container.
const SuggestionListStandalone = ({
  keyboardInteractions = true,
  popover,
  ...props
}) => {
  return (
    <SuggestionListControlled
      tabIndex={keyboardInteractions ? 0 : undefined}
      keyboardInteractions={keyboardInteractions}
      {...props}
      popover={popover}
    />
  );
};

// Core controller: provides listbox ARIA role, reads listbox id from context,
// and defaults lockSize to true when inside a Dropdown.
const SuggestionListControlled = ({
  ref,
  uiAction,
  fallback = "No results",
  children,
  renderBudget,
  searchText,
  match = defaultMatch,
  lockSize,
  ...rest
}) => {
  const isInsideDropdown = useIsInsideDropdown();
  if (lockSize === undefined && isInsideDropdown) {
    lockSize = true;
  }

  const listboxIdFromContext = useContext(ListboxIdContext);

  return (
    <List
      {...rest}
      ref={ref}
      listId={listboxIdFromContext}
      listRole="listbox"
      fallback={fallback}
      renderBudget={renderBudget}
      uiAction={uiAction}
      searchText={searchText}
      match={match}
      lockSize={lockSize}
    >
      {children}
    </List>
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
