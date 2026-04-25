import { pickPositionRelativeTo, visibleRectEffect } from "@jsenv/dom";
import { createContext } from "preact";
import {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";
import {
  List,
  ListInteractionContext,
  ListItem,
  ListPresentation,
} from "../list/list.jsx";

// Provided by SuggestionListCombo. When present, SuggestionList uses it to
// compute hidden state on each Suggestion automatically.
export const SuggestionFilterContext = createContext(null);
export const SuggestionMatchContext = createContext(null);
// Provided by SuggestionListCombo so the listbox uses the same stable id
// that the input's aria-controls points to.
export const ListboxIdContext = createContext(null);

/**
 * SuggestionList + Suggestion: a composable accessible listbox.
 *
 * Built on top of <List> / <ListItem> from src/list/list.jsx.
 * Adds: role="listbox"/role="option", keyboard navigation events,
 * hover/pointed/selected interactive state, CSS Highlight API, CSS vars.
 *
 * Usage:
 *   <SuggestionList id="my-list" uiAction={setValue}>
 *     <Suggestion value="a">Option A</Suggestion>
 *     <Suggestion value="b">Option B</Suggestion>
 *   </SuggestionList>
 *
 * CSS vars on .navi_suggestion_list:
 *   --suggestion-list-border-radius, --suggestion-list-border-width,
 *   --suggestion-list-border-color, --suggestion-list-background-color,
 *   --suggestion-list-max-height
 *
 * CSS vars on .navi_suggestion:
 *   --suggestion-padding, --suggestion-color, --suggestion-background-color, --suggestion-font-weight
 *   --suggestion-color-hover, --suggestion-background-color-hover
 *   --suggestion-color-pointed, --suggestion-background-color-pointed
 *   --suggestion-color-selected, --suggestion-background-color-selected, --suggestion-font-weight-selected
 *   --suggestion-color-pointed-selected, --suggestion-background-color-pointed-selected
 *   --suggestion-color-highlight, --suggestion-background-color-highlight
 *
 * CSS vars on .navi_suggestion_group_label:
 *   --suggestion-group-label-padding, --suggestion-group-label-color,
 *   --suggestion-group-label-font-size, --suggestion-group-label-font-weight
 */

const css = /* css */ `
  @layer navi {
    .navi_suggestion_list {
      --suggestion-list-border-radius: 4px;
      --suggestion-list-border-width: 1px;
      --suggestion-list-border-color: light-dark(#ccc, #555);
      --suggestion-list-border-style: solid;
      --suggestion-list-background-color: light-dark(#fff, #1e1e1e);
      --suggestion-list-max-height: 220px;
    }
    .navi_suggestion {
      --suggestion-padding: 8px 12px;
      --suggestion-color: inherit;
      --suggestion-font-weight: inherit;

      /* Hover (mouse) */
      --suggestion-color-hover: var(--suggestion-color);
      --suggestion-background-color-hover: light-dark(#f5f5f5, #2a2a2a);

      /* Pointed (keyboard navigation position) */
      --suggestion-color-pointed: var(--suggestion-color);
      --suggestion-background-color-pointed: light-dark(#c2d7fc, #1a4a9e);

      /* Selected */
      --suggestion-color-selected: light-dark(#1a73e8, #7baaf7);
      --suggestion-background-color-selected: light-dark(#e8f0fe, #1c3a6e);
      --suggestion-font-weight-selected: 500;

      /* Highlight (CSS Highlight API match) */
      --suggestion-color-highlight: inherit;
      --suggestion-background-color-highlight: #ffe066;
      --suggestion-color-pointed-selected: var(--suggestion-color-selected);
      --suggestion-background-color-pointed-selected: light-dark(
        #d2e3fc,
        #174ea6
      );
    }
  }

  .navi_suggestion_list {
    --x-border-radius: var(--suggestion-list-border-radius);
    --x-border-width: var(--suggestion-list-border-width);
    --x-border-color: var(--suggestion-list-border-color);
    --x-border-style: var(--suggestion-list-border-style);
    --x-background-color: var(--suggestion-list-background-color);
    width: fit-content;
    max-width: 100%;

    max-height: var(--suggestion-list-max-height);
    background-color: var(--x-background-color);
    border: var(--x-border-width) var(--x-border-style) var(--x-border-color);
    border-radius: var(--x-border-radius);
    transition: opacity 0.2s ease;
    overflow: auto;

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

  .navi_suggestion_listbox {
    box-sizing: border-box;
    width: max-content;
    min-width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  ::highlight(navi-suggestion-match) {
    color: var(--suggestion-color-highlight);
    background-color: var(--suggestion-background-color-highlight);
  }
  .navi_suggestion {
    --x-color: var(--suggestion-color);
    --x-background-color: var(--suggestion-background-color);
    --x-font-weight: var(--suggestion-font-weight);
    display: flex;
    box-sizing: border-box;
    min-width: 100%;

    padding: var(--suggestion-padding);
    color: var(--x-color);
    font-weight: var(--x-font-weight);
    background-color: var(--x-background-color);
    cursor: pointer;
    user-select: none;

    &:hover {
      --x-color: var(--suggestion-color-hover);
      --x-background-color: var(--suggestion-background-color-hover);
    }

    &[data-pointed] {
      --x-color: var(--suggestion-color-pointed);
      --x-background-color: var(--suggestion-background-color-pointed);
    }

    &[data-selected] {
      --x-color: var(--suggestion-color-selected);
      --x-background-color: var(--suggestion-background-color-selected);
      --x-font-weight: var(--suggestion-font-weight-selected);
    }

    &[data-pointed][data-selected] {
      --x-color: var(--suggestion-color-pointed-selected);
      --x-background-color: var(--suggestion-background-color-pointed-selected);
    }

    &[hidden] {
      display: none;
    }
  }
  .navi_suggestion_group_label {
    position: sticky;
    top: 0;
    z-index: 1;
    display: block;
    background-color: var(
      --suggestion-group-label-background-color,
      var(--suggestion-list-background-color)
    );
    user-select: none;

    &[data-default-label] {
      padding: 4px 12px 2px;
      color: light-dark(#888, #aaa);
      font-weight: 600;
      font-size: 0.75em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }
  .navi_list_empty {
    display: none;
    padding: var(--suggestion-padding);
    color: var(--suggestion-group-label-color);
    font-size: 0.9em;
    text-align: center;
    user-select: none;
  }
  /* Show the empty state only when there are no visible suggestions */
  .navi_suggestion_list:not(:has([role="option"]:not([hidden]))) {
    .navi_list_empty {
      display: block;
    }
  }
  /* Hide groups that have no rendered options (all their suggestions are filtered out). */
  li[role="presentation"]:not(:has([role="option"])) {
    display: none;
  }
  /* Virtual scroll fillers — must remain invisible.
     The browser may briefly flash them during scroll before the render window
     updates, so giving them a visible background would cause visual glitches. */
  .navi_list_virtual_filler {
    height: 0px;
    list-style: none;
    /* background: pink; */
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
  const listboxRef = useRef(null);

  const dispatchToSelf = (event, customEventName, customEventDetail) => {
    const el = ref.current;
    if (!el) {
      return false;
    }
    const customEvent = new CustomEvent(customEventName, {
      cancelable: true,
      detail: { event, ...customEventDetail },
    });
    el.dispatchEvent(customEvent);
    return customEvent.defaultPrevented;
  };

  useKeyboardShortcuts(ref, [
    {
      key: "arrowdown",
      description: "Point to next suggestion",
      handler: (e) =>
        dispatchToSelf(e, "navi_suggestion_list_navigate", {
          direction: "down",
        }),
    },
    {
      key: "arrowup",
      description: "Point to previous suggestion",
      handler: (e) =>
        dispatchToSelf(e, "navi_suggestion_list_navigate", { direction: "up" }),
    },
    {
      key: "home",
      description: "Point to first suggestion",
      handler: (e) =>
        dispatchToSelf(e, "navi_suggestion_list_navigate", {
          direction: "first",
        }),
    },
    {
      key: "end",
      description: "Point to last suggestion",
      handler: (e) =>
        dispatchToSelf(e, "navi_suggestion_list_navigate", {
          direction: "last",
        }),
    },
    {
      key: "enter",
      description: "Confirm pointed suggestion",
      handler: (e) => dispatchToSelf(e, "navi_suggestion_list_confirm"),
    },
    {
      key: "escape",
      description: "Clear pointed suggestion",
      handler: (e) => dispatchToSelf(e, "navi_suggestion_list_clear"),
    },
  ]);

  return (
    <SuggestionListControlled
      tabIndex={0}
      {...props}
      ref={ref}
      listboxRef={listboxRef}
    />
  );
};

// Popover variant: handles open/close/positioning events and forwards
// navigate/confirm/clear to the listbox.
const SuggestionListWithPopover = (props) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const listboxRef = useRef(null);
  const forwardToListbox = (...args) =>
    dispatchCustomEventToListbox(listboxRef, ...args);
  const cleanupRef = useRef();

  return (
    <SuggestionListControlled
      {...props}
      popover="manual"
      ref={ref}
      listboxRef={listboxRef}
      onnavi_suggestion_list_open={(e) => {
        const el = ref.current;
        if (!el) {
          return;
        }
        const anchor = e.detail?.anchor;
        el.showPopover();
        // TODO: if there is no anchor position relative to document.body (at the center of the viewport)
        const positionPopover = () => {
          const anchorRect = anchor.getBoundingClientRect();
          el.style.setProperty(
            "--suggestion-list-anchor-width",
            `${anchorRect.width}px`,
          );
          const minLeft = 1;
          const { left, top } = pickPositionRelativeTo(el, anchor, {
            positionPreference: "below",
            minLeft,
          });
          el.style.top = `${top}px`;
          const popoverRect = el.getBoundingClientRect();
          const maxWidth = parseFloat(getComputedStyle(el).maxWidth);
          if (!isNaN(maxWidth) && popoverRect.width >= maxWidth - 1) {
            const viewportWidth = document.documentElement.clientWidth;
            const centeredLeft = (viewportWidth - popoverRect.width) / 2;
            el.style.left = `${Math.max(centeredLeft, minLeft)}px`;
          } else {
            el.style.left = `${Math.max(left, minLeft)}px`;
          }
        };
        const cleanup = visibleRectEffect(anchor, ({ visibilityRatio }) => {
          if (visibilityRatio <= 0.2) {
            el.setAttribute("data-anchor-hidden", "");
            return;
          }
          el.removeAttribute("data-anchor-hidden");
          positionPopover();
        });
        cleanupRef.current = () => cleanup.disconnect();
      }}
      onnavi_suggestion_list_close={(e) => {
        const el = ref.current;
        if (!el) {
          return;
        }
        cleanupRef.current?.();
        el.removeAttribute("data-anchor-hidden");
        forwardToListbox(e, "navi_list_clear", e.detail);
        el.hidePopover();
      }}
      onnavi_suggestion_list_navigate={(e) => {
        forwardToListbox(e, "navi_list_navigate", e.detail);
      }}
      onnavi_suggestion_list_confirm={(e) => {
        forwardToListbox(e, "navi_list_confirm", e.detail);
      }}
      onnavi_suggestion_list_clear={(e) => {
        forwardToListbox(e, "navi_list_clear", e.detail);
      }}
    />
  );
};

const SuggestionListStyleCSSVars = {
  borderRadius: "--suggestion-list-border-radius",
  borderWidth: "--suggestion-list-border-width",
  borderColor: "--suggestion-list-border-color",
  backgroundColor: "--suggestion-list-background-color",
  maxHeight: "--suggestion-list-max-height",
};

// Core controller: wires the generic List to the suggestion-specific
// keyboard events, hover/selection state, and ARIA attributes.
const SuggestionListControlled = ({
  ref,
  listboxRef,
  uiAction,
  highlight,
  emptyState = "No results",
  children,
  maxHeight,
  renderBudget,
  itemHeightEstimation,
  itemHeightIsVariable,
  separator,
  expandX,
  ...rest
}) => {
  const ownId = useId();
  const id = rest.id ?? ownId;
  const listboxIdFromContext = useContext(ListboxIdContext);

  const [mousePointedValue, setMousePointedValue] = useState(null);
  const [keyboardPointedValue, setKeyboardPointedValue] = useState(null);
  const [anchorValue, setAnchorValue] = useState(null);
  const anchorValueRef = useRef(null);
  anchorValueRef.current = anchorValue;

  // Stable refs so navi_list_* event handlers always read latest state.
  const itemsRef = useRef([]);
  const onNavigateRef = useRef(null);
  onNavigateRef.current = (e) => {
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
  };

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

  const forwardToListbox = (customEventName) => (e) => {
    dispatchCustomEventToListbox(listboxRef, e, customEventName, e.detail);
  };

  return (
    <Box
      id={id}
      maxHeight={maxHeight}
      expandX={expandX}
      {...rest}
      ref={ref}
      baseClassName="navi_suggestion_list"
      styleCSSVars={SuggestionListStyleCSSVars}
      onnavi_suggestion_list_navigate={forwardToListbox("navi_list_navigate")}
      onnavi_suggestion_list_confirm={forwardToListbox("navi_list_confirm")}
      onnavi_suggestion_list_clear={forwardToListbox("navi_list_clear")}
    >
      <SuggestionListbox
        ref={listboxRef}
        id={listboxIdFromContext}
        renderBudget={renderBudget}
        itemHeightEstimation={itemHeightEstimation}
        itemHeightIsVariable={itemHeightIsVariable}
        outerRef={ref}
        interactionContext={interactionContext}
        anchorValueRef={anchorValueRef}
        onNavigateRef={onNavigateRef}
        itemsRef={itemsRef}
        uiAction={uiAction}
        emptyState={emptyState}
        separator={separator}
        expandX={expandX}
        setMousePointedValue={setMousePointedValue}
        setKeyboardPointedValue={setKeyboardPointedValue}
        setAnchorValue={setAnchorValue}
      >
        {children}
      </SuggestionListbox>
    </Box>
  );
};

// The inner <ul role="listbox"> — handles navi_list_* events and wires
// the generic List with suggestion ARIA attributes.
const SuggestionListbox = ({
  ref,
  id,
  outerRef,
  renderBudget,
  itemHeightEstimation,
  itemHeightIsVariable,
  interactionContext,
  anchorValueRef,
  onNavigateRef,
  itemsRef,
  uiAction,
  emptyState,
  separator,
  expandX,
  setMousePointedValue,
  setKeyboardPointedValue,
  setAnchorValue,
  children,
}) => {
  return (
    <List
      ref={outerRef}
      innerRef={ref}
      renderBudget={renderBudget}
      itemHeightEstimation={itemHeightEstimation}
      itemHeightIsVariable={itemHeightIsVariable}
      emptyState={emptyState}
      separator={separator}
      interactionContext={interactionContext}
      expandX={expandX}
      listProps={{
        id,
        role: "listbox",
        className: "navi_suggestion_listbox",
        onnavi_list_navigate: (e) => {
          onNavigateRef.current(e);
        },
        onnavi_list_clear: () => {
          setMousePointedValue(null);
          setKeyboardPointedValue(null);
          setAnchorValue(null);
        },
        onnavi_list_confirm: (e) => {
          const current = anchorValueRef.current;
          if (current === null) {
            return;
          }
          uiAction?.(current, e);
        },
      }}
    >
      {children}
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

const SuggestionStyleCSSVars = {
  "padding": "--suggestion-padding",
  "color": "--suggestion-color",
  "backgroundColor": "--suggestion-background-color",
  "fontWeight": "--suggestion-font-weight",
  ":-navi-pointed": {
    color: "--suggestion-color-pointed",
    backgroundColor: "--suggestion-background-color-pointed",
  },
  ":hover": {
    color: "--suggestion-color-hover",
    backgroundColor: "--suggestion-background-color-hover",
  },
  ":-navi-selected": {
    color: "--suggestion-color-selected",
    backgroundColor: "--suggestion-background-color-selected",
    fontWeight: "--suggestion-font-weight-selected",
  },
  "::highlight": {
    color: "--suggestion-color-highlight",
    backgroundColor: "--suggestion-background-color-highlight",
  },
};
const SUGGESTION_PSEUDO_CLASSES = [":-navi-pointed", ":-navi-selected"];
const SUGGESTION_PSEUDO_ELEMENTS = ["::highlight"];

/**
 * Suggestion — a selectable option inside SuggestionList.
 *
 * Thin wrapper over <ListItem> that adds:
 * - Filter context integration (hidden when filter doesn't match)
 * - role="option" + aria-selected ARIA attributes
 * - Hover / keyboard-pointed / selected interactive state
 * - CSS Highlight API text matching
 */
export const Suggestion = ({ value, hidden, ...rest }) => {
  import.meta.css = css;
  const idDefault = useId();
  const id = rest.id || idDefault;
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

  // Always track (even when hidden), delegate virtualization to ListItem.
  return (
    <ListItem itemId={id} hidden={hidden}>
      <SuggestionConcrete value={value} hidden={hidden} id={id} {...rest} />
    </ListItem>
  );
};

const SuggestionConcrete = ({
  value,
  selected,
  hidden,
  id,
  children,
  ...rest
}) => {
  const {
    mousePointedValue,
    keyboardPointedValue,
    highlight,
    onHover,
    onSelect,
  } = useContext(ListInteractionContext) ?? {};

  const isPointed =
    keyboardPointedValue === value || mousePointedValue === value;
  const isKeyboardPointed = keyboardPointedValue === value;
  const suggestionRef = useRef(null);

  useLayoutEffect(() => {
    if (!isKeyboardPointed) {
      return;
    }
    const suggestionEl = suggestionRef.current;
    if (!suggestionEl) {
      return;
    }
    suggestionEl.scrollIntoView({ block: "nearest" });
  }, [isKeyboardPointed]);

  useLayoutEffect(() => {
    const hl = getNaviSuggestionHighlight();
    if (!hl) {
      return undefined;
    }
    const suggestionEl = suggestionRef.current;
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
  }, [highlight, children]);

  return (
    <Box
      as="span"
      ref={suggestionRef}
      baseClassName="navi_suggestion"
      id={id}
      role="option"
      aria-selected={selected}
      aria-hidden={hidden ? true : undefined}
      hidden={hidden}
      basePseudoState={{
        ":-navi-pointed": isPointed,
        ":-navi-selected": selected,
      }}
      pseudoClasses={SUGGESTION_PSEUDO_CLASSES}
      pseudoElements={SUGGESTION_PSEUDO_ELEMENTS}
      styleCSSVars={SuggestionStyleCSSVars}
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
    >
      {children}
    </Box>
  );
};

export const SuggestionGroup = ({ label, children, ...rest }) => {
  import.meta.css = css;
  const groupId = useId();
  return (
    <ListPresentation {...rest}>
      <span
        id={groupId}
        role="presentation"
        aria-hidden="true"
        style={{ display: "contents" }}
      >
        <span
          className="navi_suggestion_group_label"
          data-default-label={typeof label === "string" ? "" : undefined}
        >
          {label}
        </span>
      </span>
      <ul
        role="group"
        aria-labelledby={groupId}
        style={{ margin: 0, padding: 0, listStyle: "none" }}
      >
        {children}
      </ul>
    </ListPresentation>
  );
};
