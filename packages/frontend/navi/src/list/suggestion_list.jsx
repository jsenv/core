import { pickPositionRelativeTo, visibleRectEffect } from "@jsenv/dom";
import { createContext } from "preact";
import {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { useIsInsideDropdown } from "./dropdown.jsx";
import { List, ListItem, RenderWindowContext } from "./list.jsx";

export const SetFilterContext = createContext(null);
// Provided so the listbox uses the same stable id that the input's
// aria-controls points to.
export const ListboxIdContext = createContext(null);
const ListInteractionContext = createContext(null);

const css = /* css */ `
  .navi_list_container[popover] {
    position: absolute;
    inset: unset;
    min-width: var(--suggestion-list-anchor-width, 0px);
    max-width: 95vw;
    margin: 0;
    padding: 0;
    /* border: none; */
  }
  &[data-anchor-hidden] {
    opacity: 0;
    pointer-events: none;
  }
  &[data-lock-sizing] {
    visibility: hidden;
  }

  ::highlight(navi-suggestion-match) {
    color: var(--list-item-color-highlight);
    background-color: var(--list-item-background-color-highlight);
  }
`;

const dispatchCustomEventToList = (
  listRef,
  event,
  customEventName,
  customEventDetail,
) => {
  const listEl = listRef.current;
  if (!listEl) {
    return false;
  }
  const customEvent = new CustomEvent(customEventName, {
    cancelable: true,
    detail: {
      event,
      ...customEventDetail,
    },
  });
  listEl.dispatchEvent(customEvent);
  return customEvent.defaultPrevented;
};

/**
 * SuggestionList — a keyboard-navigable, filterable listbox.
 *
 * Props:
 *   uiAction    — called with the selected value when the user confirms a suggestion
 *   fallback    — content shown when no suggestions are visible (default: "No results")
 *   popover     — when true, renders as a managed popover (positioned near an anchor)
 *
 *   withFilter  — when true, the list owns its filter state internally. An <Input>
 *                 placed anywhere inside (e.g. in a <ListItemHeader>) auto-connects
 *                 to the filter via SetFilterContext. Each <Suggestion> is
 *                 automatically hidden when it doesn't match the filter.
 *   match       — custom match function (value, lowerCaseFilter) => boolean.
 *                 Only used when withFilter is true. Default: substring match.
 *   filter      — external filter string. Use when you manage the filter state
 *                 yourself (without withFilter). Suggestions whose value does not
 *                 match are hidden. Also used as the default highlight string.
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
export const SuggestionList = ({ popover, withFilter, match, ...rest }) => {
  import.meta.css = css;
  if (withFilter) {
    return (
      <SuggestionListWithFilter match={match} popover={popover} {...rest} />
    );
  }
  if (popover) {
    return <SuggestionListWithPopover {...rest} />;
  }
  return <SuggestionListStandalone {...rest} />;
};

const defaultMatch = (v, filter) => String(v).toLowerCase().includes(filter);

// Owns filter state and provides SetFilterContext + ListboxIdContext.
// Passes filter and match as props down to the inner SuggestionList.
const SuggestionListWithFilter = ({ match = defaultMatch, ...rest }) => {
  const [filter, setFilter] = useState("");
  const listboxId = useId();

  return (
    <SetFilterContext.Provider value={setFilter}>
      <ListboxIdContext.Provider value={listboxId}>
        <SuggestionList
          {...rest}
          filter={filter}
          match={match}
          keyboardInteractions={false}
        />
      </ListboxIdContext.Provider>
    </SetFilterContext.Provider>
  );
};

// Standalone variant: attaches keyboard shortcuts to the container and
// forwards them as custom events to itself (navi_suggestion_list_* events).
const SuggestionListStandalone = ({
  keyboardInteractions = true,
  ...props
}) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const dispatchToList = (...args) => dispatchCustomEventToList(ref, ...args);

  useKeyboardShortcuts(keyboardInteractions ? ref : { current: null }, [
    {
      key: "arrowdown",
      description: "Point to next suggestion",
      handler: (e) => {
        dispatchToList(e, "navi_list_nav", { direction: "down" });
      },
    },
    {
      key: "arrowup",
      description: "Point to previous suggestion",
      handler: (e) => dispatchToList(e, "navi_list_nav", { direction: "up" }),
    },
    {
      key: "home",
      description: "Point to first suggestion",
      handler: (e) =>
        dispatchToList(e, "navi_list_nav", { direction: "first" }),
    },
    {
      key: "end",
      description: "Point to last suggestion",
      handler: (e) => dispatchToList(e, "navi_list_nav", { direction: "last" }),
    },
    {
      key: "enter",
      description: "Confirm pointed suggestion",
      handler: (e) => dispatchToList(e, "navi_list_confirm"),
    },
    {
      key: "escape",
      description: "Clear pointed suggestion",
      handler: (e) => dispatchToList(e, "navi_list_clear"),
    },
  ]);

  return (
    <SuggestionListControlled
      tabIndex={keyboardInteractions ? 0 : undefined}
      {...props}
      ref={ref}
    />
  );
};

// Popover variant: handles open/close/positioning events and forwards
// navigate/confirm/clear to the listbox.
const SuggestionListWithPopover = (props) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const dispatchToList = (...args) => dispatchCustomEventToList(ref, ...args);
  const cleanupRef = useRef();

  return (
    <SuggestionListControlled
      {...props}
      popover="manual"
      ref={ref}
      onnavi_list_open={(e) => {
        const listContainerEl = ref.current;
        if (!listContainerEl) {
          return;
        }
        const anchor = e.detail?.anchor;
        listContainerEl.showPopover();
        // TODO: if there is no anchor position relative to document.body (at the center of the viewport)
        const positionPopover = () => {
          const anchorRect = anchor.getBoundingClientRect();
          listContainerEl.style.setProperty(
            "--list-anchor-width",
            `${anchorRect.width}px`,
          );
          const minLeft = 1;
          const { left, top } = pickPositionRelativeTo(
            listContainerEl,
            anchor,
            {
              positionPreference: "below",
              minLeft,
            },
          );
          listContainerEl.style.top = `${top}px`;
          const popoverRect = listContainerEl.getBoundingClientRect();
          const maxWidth = parseFloat(
            getComputedStyle(listContainerEl).maxWidth,
          );
          if (!isNaN(maxWidth) && popoverRect.width >= maxWidth - 1) {
            const viewportWidth = document.documentElement.clientWidth;
            const centeredLeft = (viewportWidth - popoverRect.width) / 2;
            listContainerEl.style.left = `${Math.max(centeredLeft, minLeft)}px`;
          } else {
            listContainerEl.style.left = `${Math.max(left, minLeft)}px`;
          }
        };
        const cleanup = visibleRectEffect(anchor, ({ visibilityRatio }) => {
          if (visibilityRatio <= 0.2) {
            listContainerEl.setAttribute("data-anchor-hidden", "");
            return;
          }
          listContainerEl.removeAttribute("data-anchor-hidden");
          positionPopover();
        });
        cleanupRef.current = () => cleanup.disconnect();
      }}
      onnavi_list_close={(e) => {
        const listContainerEl = ref.current;
        if (!listContainerEl) {
          return;
        }
        cleanupRef.current?.();
        listContainerEl.removeAttribute("data-anchor-hidden");
        dispatchToList(e, "navi_list_clear", e.detail);
        listContainerEl.hidePopover();
      }}
    />
  );
};

// Core controller: wires the generic List to the suggestion-specific
// keyboard events, hover/selection state, and ARIA attributes.
//
// filter    — the current filter string. When lockSize is also enabled, the
//             filter is bypassed on the first render so the container can be
//             measured at its full (unfiltered) size before any hiding occurs.
// lockSize  — when true, observes the list container with a ResizeObserver
//             and captures its width/height once it has non-zero dimensions.
//             The filter is bypassed during this first measurement so the size
//             always reflects the fully-populated state. Those values become
//             min-width/min-height so that subsequent filtering cannot collapse
//             the layout. Size is captured once per mount.
const SuggestionListControlled = ({
  ref,
  uiAction,
  highlight,
  fallback = "No results",
  children,
  renderBudget,
  filter,
  match = defaultMatch,
  lockSize,
  ...rest
}) => {
  const isInsideDropdown = useIsInsideDropdown();
  if (lockSize === undefined && isInsideDropdown) {
    lockSize = true;
  }

  const listboxIdFromContext = useContext(ListboxIdContext);

  const [mousePointedValue, setMousePointedValue] = useState(null);
  const [keyboardPointedValue, setKeyboardPointedValue] = useState(null);
  const [anchorValue, setAnchorValue] = useState(null);
  const anchorValueRef = useRef(null);
  anchorValueRef.current = anchorValue;

  // lockSize: capture container dimensions in unfiltered state, then apply filter.
  // filterBypassed starts true so the first render always shows all items.
  const defaultRef = useRef(null);
  const resolvedRef = ref || defaultRef;
  const sizeLocked = useRef(false);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const [filterBypassed, setFilterBypassed] = useState(
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
      if (filterRef.current) {
        setFilterBypassed(false);
      }
    });
    observer.observe(listContainerEl);
    listContainerEl.setAttribute("data-lock-sizing", "");
    return () => {
      observer.disconnect();
      listContainerEl.removeAttribute("data-lock-sizing");
    };
  }, [lockSize]);

  // When a filter is active, fall back to filter text for highlight.
  // While bypassing the filter (for lockSize measurement), treat as no filter.
  const effectiveFilter = filterBypassed ? undefined : filter;

  if (highlight === undefined) {
    highlight = effectiveFilter;
  }

  const interactionContext = {
    mousePointedValue,
    keyboardPointedValue,
    highlight,
    filter: effectiveFilter,
    match,
    onHover: (value) => {
      setMousePointedValue(value);
    },
    onSelect: (value, event) => {
      setAnchorValue(value);
      uiAction?.(value, event);
    },
  };

  const itemsRef = useRef([]);

  return (
    <List
      {...rest}
      ref={resolvedRef}
      listId={listboxIdFromContext}
      listRole="listbox"
      fallback={fallback}
      renderBudget={renderBudget}
      itemsRef={itemsRef}
      onnavi_list_nav={(e) => {
        const { direction, event = e } = e.detail;
        const items = itemsRef.current;
        if (items.length === 0) {
          return;
        }
        const current = anchorValueRef.current;
        const onNav = (value) => {
          event.preventDefault();
          anchorValueRef.current = value;
          setKeyboardPointedValue(value);
          setAnchorValue(value);
        };
        const values = items.map((item) => item.value);
        if (direction === "down") {
          const idx = current === null ? -1 : values.indexOf(current);
          const belowValue = values[idx < values.length - 1 ? idx + 1 : idx];
          onNav(belowValue);
        } else if (direction === "up") {
          const idx = current === null ? -1 : values.indexOf(current);
          const aboveValue = values[idx > 0 ? idx - 1 : idx];
          onNav(aboveValue);
        } else if (direction === "first") {
          const firstValue = values[0];
          onNav(firstValue);
        } else if (direction === "last") {
          const lastValue = values[values.length - 1];
          onNav(lastValue);
        }
      }}
      onnavi_list_clear={() => {
        setMousePointedValue(null);
        setKeyboardPointedValue(null);
        setAnchorValue(null);
      }}
      onnavi_list_confirm={(e) => {
        const current = anchorValueRef.current;
        if (current === null) {
          return;
        }
        uiAction?.(current, e);
      }}
    >
      <ListInteractionContext.Provider value={interactionContext}>
        {children}
      </ListInteractionContext.Provider>
    </List>
  );
};

// Module-level shared Highlight instance.
let naviSuggestionHighlight = null;
const getNaviSuggestionHighlight = () => {
  if (!CSS.highlights) {
    return null;
  }
  if (!naviSuggestionHighlight) {
    naviSuggestionHighlight = new Highlight();
    CSS.highlights.set("navi-suggestion-match", naviSuggestionHighlight);
  }
  return naviSuggestionHighlight;
};

/**
 * Suggestion — a selectable option inside SuggestionList.
 *
 * Thin wrapper over <ListItem> that adds:
 * - Filter context integration (hidden when filter doesn't match)
 * - role="option" + aria-selected ARIA attributes
 * - Hover / keyboard-pointed / selected interactive state
 * - CSS Highlight API text matching
 */
export const Suggestion = ({ value, hidden, selected, children, ...rest }) => {
  const {
    mousePointedValue,
    keyboardPointedValue,
    highlight,
    filter,
    match,
    onHover,
    onSelect,
  } = useContext(ListInteractionContext);
  const isPointed =
    keyboardPointedValue === value || mousePointedValue === value;
  const isKeyboardPointed = keyboardPointedValue === value;

  if (filter) {
    const lowerFilter = filter.toLowerCase();
    const matches = match(value, lowerFilter);
    hidden = !matches;
  }
  const defaultRef = useRef(null);
  const ref = rest.ref || defaultRef;
  const renderWindow = useContext(RenderWindowContext);

  useLayoutEffect(() => {
    if (!isKeyboardPointed) {
      return;
    }
    const suggestionEl = ref.current;
    if (!suggestionEl) {
      return;
    }
    suggestionEl.scrollIntoView({ block: "nearest" });
  }, [isKeyboardPointed]);

  useLayoutEffect(() => {
    if (hidden) {
      return undefined;
    }
    const hl = getNaviSuggestionHighlight();
    if (!hl) {
      return undefined;
    }
    const suggestionEl = ref.current;
    if (!suggestionEl || !highlight) {
      return undefined;
    }
    const ownRanges = [];
    const lowerHighlight = highlight.toLowerCase();
    const walker = document.createTreeWalker(
      suggestionEl,
      NodeFilter.SHOW_TEXT,
    );
    let node;
    while ((node = walker.nextNode())) {
      const lowerText = node.textContent.toLowerCase();
      let index = lowerText.indexOf(lowerHighlight);
      while (index !== -1) {
        const range = new Range();
        range.setStart(node, index);
        range.setEnd(node, index + highlight.length);
        hl.add(range);
        ownRanges.push(range);
        index = lowerText.indexOf(lowerHighlight, index + 1);
      }
    }
    return () => {
      for (const range of ownRanges) {
        hl.delete(range);
      }
    };
  }, [highlight, children, hidden, renderWindow]);

  return (
    <ListItem
      role="option"
      aria-selected={selected}
      hidden={hidden}
      id={value}
      value={value}
      data-anchor={isKeyboardPointed ? "" : undefined}
      baseClassName="navi_list_item navi_suggestion"
      basePseudoState={{
        ":-navi-pointed": isPointed,
        ":-navi-selected": selected,
      }}
      onMouseEnter={(e) => {
        if (hidden) {
          return;
        }
        onHover?.(value, e);
      }}
      onMouseLeave={(e) => {
        if (hidden) {
          return;
        }
        onHover?.(null, e);
      }}
      onMouseDown={(e) => {
        if (hidden || e.button !== 0) {
          return;
        }
        onSelect?.(value, e);
      }}
      {...rest}
      ref={ref}
    >
      {children}
    </ListItem>
  );
};
