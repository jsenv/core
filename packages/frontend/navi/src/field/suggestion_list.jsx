import { pickPositionRelativeTo, visibleRectEffect } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef, useState } from "preact/hooks";

import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { List, ListItem } from "../list/list.jsx";

// Provided by SuggestionListCombo. When present, SuggestionList uses it to
// compute hidden state on each Suggestion automatically.
export const SuggestionFilterContext = createContext(null);
export const SuggestionMatchContext = createContext(null);
// Provided by SuggestionListCombo so the listbox uses the same stable id
// that the input's aria-controls points to.
export const ListboxIdContext = createContext(null);
const ListInteractionContext = createContext(null);

const css = /* css */ `
  .navi_suggestion_list {
    /* Popover reset — browser adds border, background, padding, margin by default */
    &[popover] {
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
  }

  ::highlight(navi-suggestion-match) {
    color: var(--list-item-color-highlight);
    background-color: var(--list-item-background-color-highlight);
  }
`;

const dispatchCustomEventToListbox = (
  listboxRef,
  event,
  customEventName,
  customEventDetail,
) => {
  const listbox = listboxRef.current;
  if (!listbox) {
    return false;
  }
  const customEvent = new CustomEvent(customEventName, {
    cancelable: true,
    detail: {
      event,
      ...customEventDetail,
    },
  });
  listbox.dispatchEvent(customEvent);
  return customEvent.defaultPrevented;
};

// Single entry point. Renders either the popover variant or the standalone
// variant depending on the `popover` prop.
export const SuggestionList = ({ popover, ...rest }) => {
  import.meta.css = css;
  if (popover) {
    return <SuggestionListWithPopover {...rest} />;
  }
  return <SuggestionListStandalone {...rest} />;
};

// Standalone variant: attaches keyboard shortcuts to the container and
// forwards them as custom events to itself (navi_suggestion_list_* events).
const SuggestionListStandalone = (props) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const dispatchToList = (...args) =>
    dispatchCustomEventToListbox(ref, ...args);
  useKeyboardShortcuts(ref, [
    {
      key: "arrowdown",
      description: "Point to next suggestion",
      handler: (e) => dispatchToList(e, "navi_list_nav", { direction: "down" }),
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
  const dispatchToList = (...args) =>
    dispatchCustomEventToListbox(ref, ...args);
  const cleanupRef = useRef();

  return (
    <SuggestionListControlled
      {...props}
      popover="manual"
      ref={ref}
      onnavi_list_open={(e) => {
        const listEl = ref.current;
        if (!listEl) {
          return;
        }
        const containerEl = listEl.parentNode;
        const anchor = e.detail?.anchor;
        containerEl.showPopover();
        // TODO: if there is no anchor position relative to document.body (at the center of the viewport)
        const positionPopover = () => {
          const anchorRect = anchor.getBoundingClientRect();
          containerEl.style.setProperty(
            "--list-anchor-width",
            `${anchorRect.width}px`,
          );
          const minLeft = 1;
          const { left, top } = pickPositionRelativeTo(containerEl, anchor, {
            positionPreference: "below",
            minLeft,
          });
          containerEl.style.top = `${top}px`;
          const popoverRect = containerEl.getBoundingClientRect();
          const maxWidth = parseFloat(getComputedStyle(containerEl).maxWidth);
          if (!isNaN(maxWidth) && popoverRect.width >= maxWidth - 1) {
            const viewportWidth = document.documentElement.clientWidth;
            const centeredLeft = (viewportWidth - popoverRect.width) / 2;
            containerEl.style.left = `${Math.max(centeredLeft, minLeft)}px`;
          } else {
            containerEl.style.left = `${Math.max(left, minLeft)}px`;
          }
        };
        const cleanup = visibleRectEffect(anchor, ({ visibilityRatio }) => {
          if (visibilityRatio <= 0.2) {
            containerEl.setAttribute("data-anchor-hidden", "");
            return;
          }
          containerEl.removeAttribute("data-anchor-hidden");
          positionPopover();
        });
        cleanupRef.current = () => cleanup.disconnect();
      }}
      onnavi_list_close={(e) => {
        const listEl = ref.current;
        if (!listEl) {
          return;
        }
        cleanupRef.current?.();
        listEl.removeAttribute("data-anchor-hidden");
        dispatchToList(e, "navi_list_clear", e.detail);
        listEl.hidePopover();
      }}
      onnavi_list_nav={(e) => {
        dispatchToList(e, "navi_list_nav", e.detail);
      }}
      onnavi_list_confirm={(e) => {
        dispatchToList(e, "navi_list_confirm", e.detail);
      }}
      onnavi_list_clear={(e) => {
        dispatchToList(e, "navi_list_clear", e.detail);
      }}
    />
  );
};

// Core controller: wires the generic List to the suggestion-specific
// keyboard events, hover/selection state, and ARIA attributes.
const SuggestionListControlled = ({
  ref,
  listboxRef,
  uiAction,
  highlight,
  fallback = "No results",
  children,
  renderBudget,
  itemHeightEstimation,
  itemHeightIsVariable,
  ...rest
}) => {
  const listboxIdFromContext = useContext(ListboxIdContext);

  const [mousePointedValue, setMousePointedValue] = useState(null);
  const [keyboardPointedValue, setKeyboardPointedValue] = useState(null);
  const [anchorValue, setAnchorValue] = useState(null);
  const anchorValueRef = useRef(null);
  anchorValueRef.current = anchorValue;

  // Stable refs so navi_list_* event handlers always read latest state.
  const itemsRef = useRef([]);

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
    // Expose items setter so ListInner can update itemsRef after each render.
    setItems: (items) => {
      itemsRef.current = items;
    },
  };

  return (
    <List
      {...rest}
      ref={ref}
      innerRef={listboxRef}
      id={listboxIdFromContext}
      className="navi_suggestion_list"
      role="listbox"
      fallback={fallback}
      renderBudget={renderBudget}
      itemHeightEstimation={itemHeightEstimation}
      itemHeightIsVariable={itemHeightIsVariable}
      onnavi_list_nav={(e) => {
        const { direction, event = e } = e.detail;
        const values = itemsRef.current;
        if (values.length === 0) {
          return;
        }
        const current = anchorValueRef.current;
        const onNav = (value) => {
          event.preventDefault();
          anchorValueRef.current = value;
          setKeyboardPointedValue(value);
          setAnchorValue(value);
        };
        if (direction === "down") {
          const idx = current === null ? -1 : values.indexOf(current);
          onNav(values[idx < values.length - 1 ? idx + 1 : idx]);
        } else if (direction === "up") {
          const idx = current === null ? -1 : values.indexOf(current);
          onNav(values[idx > 0 ? idx - 1 : 0]);
        } else if (direction === "first") {
          onNav(values[0]);
        } else if (direction === "last") {
          onNav(values[values.length - 1]);
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
  }, [highlight, children, hidden]);

  return (
    <ListItem
      role="option"
      aria-selected={selected}
      hidden={hidden}
      baseClassName="navi_suggestion"
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
