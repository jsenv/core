import { createContext } from "preact";
import {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { useIsInsideDropdown } from "./dropdown.jsx";
import { List, ListItem, ListSearchContext } from "./list.jsx";

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

// Core controller: wires the generic List to suggestion-specific concerns:
// search text filtering/highlighting and optional size locking.
//
// searchText — the current search string. When lockSize is also enabled, the
//              searchText is bypassed on the first render so the container can
//              be measured at its full (unfiltered) size before any hiding occurs.
// lockSize   — when true, observes the list container with a ResizeObserver
//              and captures its width/height once it has non-zero dimensions.
//              The searchText is bypassed during this first measurement so the
//              size always reflects the fully-populated state. Those values become
//              min-width/min-height so that subsequent filtering cannot collapse
//              the layout. Size is captured once per mount.
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

  // lockSize: capture container dimensions in unfiltered state, then apply searchText.
  // searchTextBypassed starts true so the first render always shows all items.
  const defaultRef = useRef(null);
  const resolvedRef = ref || defaultRef;
  const sizeLocked = useRef(false);
  const searchTextRef = useRef(searchText);
  searchTextRef.current = searchText;
  const [searchTextBypassed, setSearchTextBypassed] = useState(
    () => Boolean(lockSize) && !sizeLocked.current,
  );
  useLayoutEffect(() => {
    if (!lockSize) {
      return undefined;
    }
    if (sizeLocked.current) {
      return undefined;
    }
    const listContainerEl = resolvedRef.current;
    if (!listContainerEl) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      // Use borderBoxSize (outer width) not contentRect (which excludes the
      // scrollbar width). If we used contentRect, min-width would be set to
      // outerWidth - scrollbarWidth, and the container would shrink by exactly
      // the scrollbar width when the scrollbar disappears.
      const borderBoxEntry = entry.borderBoxSize
        ? entry.borderBoxSize[0]
        : null;
      const width = borderBoxEntry
        ? borderBoxEntry.inlineSize
        : entry.contentRect.width;
      const height = borderBoxEntry
        ? borderBoxEntry.blockSize
        : entry.contentRect.height;
      if (width === 0 && height === 0) {
        return;
      }
      listContainerEl.style.minWidth = `${width}px`;
      listContainerEl.style.minHeight = `${height}px`;
      sizeLocked.current = true;
      observer.disconnect();
      listContainerEl.removeAttribute("data-lock-sizing");
      if (searchTextRef.current) {
        setSearchTextBypassed(false);
      }
    });
    observer.observe(listContainerEl);
    listContainerEl.setAttribute("data-lock-sizing", "");
    return () => {
      observer.disconnect();
      listContainerEl.removeAttribute("data-lock-sizing");
    };
  }, [lockSize]);

  // While bypassing the searchText (for lockSize measurement), treat as empty.
  const effectiveSearchText = searchTextBypassed ? undefined : searchText;

  const searchContext = { searchText: effectiveSearchText, match };

  return (
    <ListSearchContext.Provider value={searchContext}>
      <List
        {...rest}
        ref={resolvedRef}
        listId={listboxIdFromContext}
        listRole="listbox"
        fallback={fallback}
        renderBudget={renderBudget}
        uiAction={uiAction}
      >
        {children}
      </List>
    </ListSearchContext.Provider>
  );
};

/**
 * Suggestion — a selectable option inside SuggestionList.
 *
 * Thin wrapper over <ListItem> that adds role="option" and ARIA attributes.
 * Search-based hiding and text highlighting are handled by <ListItem> via
 * ListSearchContext.
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
