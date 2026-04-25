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
import { List, ListItem, RenderWindowContext } from "../list/list.jsx";

// Provided when SuggestionList has withFilter={true} (or by SuggestionListCombo).
// When present, SuggestionList uses them to compute hidden state on each
// Suggestion automatically and to sync the Input value.
export const SuggestionFilterContext = createContext(null);
export const SuggestionMatchContext = createContext(null);
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

// Single entry point. Renders either the popover variant or the standalone
// variant depending on the `popover` prop.
// When `withFilter` is true, the list owns its filter state and provides
// SuggestionFilterContext + SetFilterContext so that an <Input> inside
// (e.g. in a <ListItemHeader>) auto-connects to the filter.
// `lockSize` (only meaningful with `withFilter`) locks the container dimensions
// once populated so filtering cannot shrink the layout.
export const SuggestionList = ({
  popover,
  withFilter,
  lockSize,
  match,
  ...rest
}) => {
  import.meta.css = css;
  if (withFilter) {
    return (
      <SuggestionListWithFilter
        lockSize={lockSize}
        match={match}
        popover={popover}
        {...rest}
      />
    );
  }
  if (popover) {
    return <SuggestionListWithPopover {...rest} />;
  }
  return <SuggestionListStandalone {...rest} />;
};

const defaultMatch = (v, filter) => String(v).toLowerCase().includes(filter);

// Owns filter state and provides all filter-related contexts.
// Dispatches to SuggestionListWithPopover or SuggestionListStandalone.
/*

 * lockSize: measures the container once it first has non-zero dimensions (i.e.
 *           once it becomes visible, e.g. when a parent <dialog> opens), then
 *           sets minWidth/minHeight so filtering cannot shrink the container —
 *           the size is anchored to the fully-populated state. The container
 *           can still grow if content happens to be taller, hence min* and not
 *           a hard fixed size. sizeLocked ensures we only capture the size once,
 *           so a subsequent filter→clear cycle does not re-measure a smaller box.
*/
const SuggestionListWithFilter = ({
  match = defaultMatch,
  lockSize,
  ...rest
}) => {
  const [filter, setFilter] = useState("");
  const listboxId = useId();
  const defaultRef = useRef(null);
  const ref = rest.ref || defaultRef;
  const sizeLocked = useRef(false);

  useLayoutEffect(() => {
    if (!lockSize) {
      return undefined;
    }
    if (sizeLocked.current) {
      return undefined;
    }
    if (filter !== "") {
      return undefined;
    }
    const listEl = ref.current;
    if (!listEl) {
      return undefined;
    }
    // Observe the scroll container (parent of the <ul> = navi_list_container)
    const containerEl = listEl.parentElement;
    if (!containerEl) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      if (width === 0 && height === 0) {
        return;
      }
      containerEl.style.minWidth = `${width}px`;
      containerEl.style.minHeight = `${height}px`;
      sizeLocked.current = true;
      observer.disconnect();
    });
    observer.observe(containerEl);
    return () => {
      observer.disconnect();
    };
  }, [lockSize, filter]);

  const inner = <SuggestionList {...rest} ref={ref} />;

  return (
    <SuggestionMatchContext.Provider value={match}>
      <SuggestionFilterContext.Provider value={filter}>
        <SetFilterContext.Provider value={setFilter}>
          <ListboxIdContext.Provider value={listboxId}>
            {inner}
          </ListboxIdContext.Provider>
        </SetFilterContext.Provider>
      </SuggestionFilterContext.Provider>
    </SuggestionMatchContext.Provider>
  );
};

// Standalone variant: attaches keyboard shortcuts to the container and
// forwards them as custom events to itself (navi_suggestion_list_* events).
const SuggestionListStandalone = (props) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const dispatchToList = (...args) => dispatchCustomEventToList(ref, ...args);
  useKeyboardShortcuts(ref, [
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

  return <SuggestionListControlled tabIndex={0} {...props} ref={ref} />;
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
const SuggestionListControlled = ({
  ref,
  uiAction,
  highlight,
  fallback = "No results",
  children,
  renderBudget,
  ...rest
}) => {
  const listboxIdFromContext = useContext(ListboxIdContext);

  const [mousePointedValue, setMousePointedValue] = useState(null);
  const [keyboardPointedValue, setKeyboardPointedValue] = useState(null);
  const [anchorValue, setAnchorValue] = useState(null);
  const anchorValueRef = useRef(null);
  anchorValueRef.current = anchorValue;

  // When a filter is active, fall back to filter text for highlight.
  const filter = useContext(SuggestionFilterContext);
  if (highlight === undefined) {
    highlight = filter;
  }

  const interactionContext = {
    mousePointedValue,
    keyboardPointedValue,
    highlight,
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
      ref={ref}
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
    onHover,
    onSelect,
  } = useContext(ListInteractionContext);
  const isPointed =
    keyboardPointedValue === value || mousePointedValue === value;
  const isKeyboardPointed = keyboardPointedValue === value;

  // When inside SuggestionListCombo, compute hidden from the filter context.
  const filter = useContext(SuggestionFilterContext);
  const match = useContext(SuggestionMatchContext);
  let matches = true;
  if (filter) {
    const lowerFilter = filter.toLowerCase();
    matches = match(value, lowerFilter);
    hidden = !matches;
  }
  if (hidden === undefined && !matches) {
    hidden = true;
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
