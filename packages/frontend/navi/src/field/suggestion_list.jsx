import { pickPositionRelativeTo, visibleRectEffect } from "@jsenv/dom";
import { createContext } from "preact";
import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { createItemTracker } from "./item_tracker/item_tracker.jsx";

const [useSuggestionItemTrackerProvider, useTrackSuggestion] =
  createItemTracker();

/**
 * SuggestionList + Suggestion: a composable accessible listbox.
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
      --suggestion-background-color-pointed: light-dark(#e8f0fe, #1c3a6e);

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

    .navi_suggestion_listbox_filler {
      height: 0px;
      list-style: none;
      pointer-events: none;
    }
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
    width: max-content;
    min-width: 100%;

    padding: var(--suggestion-padding);
    flex-direction: column;
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
  .navi_suggestion_listbox_empty {
    display: none;
    padding: var(--suggestion-padding);
    color: var(--suggestion-group-label-color);
    font-size: 0.9em;
    text-align: center;
    user-select: none;
  }
  /* Show the empty state only when there are no visible suggestions */
  .navi_suggestion_list:not(:has([role="option"]:not([hidden]))) {
    .navi_suggestion_listbox_empty {
      display: block;
    }
  }
`;

// Single entry point. Renders either the popover variant or the standalone
// variant depending on the `popover` prop.
export const SuggestionList = ({ popover, ...rest }) => {
  import.meta.css = css;
  if (popover) {
    return <SuggestionListWithPopover {...rest} />;
  }
  return <SuggestionListStandalone {...rest} />;
};

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

// Standalone variant: attaches keyboard shortcuts to the container and
// forwards them as custom events to the listbox.
const SuggestionListStandalone = (props) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const listboxRef = useRef(null);
  const forwardToListbox = (...args) =>
    dispatchCustomEventToListbox(listboxRef, ...args);

  useKeyboardShortcuts(ref, [
    {
      key: "arrowdown",
      description: "Point to next suggestion",
      handler: (e) =>
        forwardToListbox(e, "navi_list_navigate", { direction: "down" }),
    },
    {
      key: "arrowup",
      description: "Point to previous suggestion",
      handler: (e) =>
        forwardToListbox(e, "navi_list_navigate", { direction: "up" }),
    },
    {
      key: "home",
      description: "Point to first suggestion",
      handler: (e) =>
        forwardToListbox(e, "navi_list_navigate", { direction: "first" }),
    },
    {
      key: "end",
      description: "Point to last suggestion",
      handler: (e) =>
        forwardToListbox(e, "navi_list_navigate", { direction: "last" }),
    },
    {
      key: "enter",
      description: "Confirm pointed suggestion",
      handler: (e) => forwardToListbox(e, "navi_list_confirm"),
    },
    {
      key: "escape",
      description: "Clear pointed suggestion",
      handler: (e) => forwardToListbox(e, "navi_list_clear"),
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

// Carries the virtual scroll window (enabled, start, end) set by
// SuggestionContainerControlled and consumed by each Suggestion wrapper to decide
// whether to render.
const MIN_ITEM_HEIGHT = 20; // px — conservative lower bound for filler height estimation
const VS_BUFFER = 5; // extra items to render above and below the visible window

// Core: VS detection, scroll listener, median measurement, and the <Box>
// scroll container + <SuggestionListbox>. Controlled by either
// SuggestionListStandalone or SuggestionListWithPopover.
const SuggestionListControlled = ({
  ref,
  listboxRef,
  uiAction,
  highlight,
  emptyState = "No results",
  children,
  maxHeight,
  ...rest
}) => {
  const ownId = useId();
  const id = rest.id ?? ownId;

  // Detect max-height on mount and enable virtual scroll when present.
  const [vsState, setVsState] = useState({
    enabled: false,
    start: 0,
    end: VS_BUFFER * 2,
  });
  useLayoutEffect(() => {
    const listEl = ref.current;
    if (!listEl) {
      return;
    }
    const maxHeightStr = getComputedStyle(listEl).maxHeight;
    if (!maxHeightStr || maxHeightStr === "none") {
      return;
    }
    const maxHeightPx = parseFloat(maxHeightStr);
    if (isNaN(maxHeightPx) || maxHeightPx <= 0) {
      return;
    }
    const itemsPerView = Math.ceil(maxHeightPx / MIN_ITEM_HEIGHT);
    setVsState({
      enabled: true,
      start: 0,
      end: VS_BUFFER + itemsPerView + VS_BUFFER,
    });
  }, [maxHeight]);

  // Measure real item height once, right after the first VS window renders.
  const medianHeightRef = useRef(MIN_ITEM_HEIGHT);
  useLayoutEffect(() => {
    if (!vsState.enabled) {
      return;
    }
    const listEl = ref.current;
    if (!listEl) {
      return;
    }
    const options = Array.from(listEl.querySelectorAll("[role='option']"));
    if (options.length === 0) {
      return;
    }
    const heights = options.map((el) => el.getBoundingClientRect().height);
    heights.sort((a, b) => a - b);
    const mid = Math.floor(heights.length / 2);
    medianHeightRef.current =
      heights.length % 2 === 0
        ? (heights[mid - 1] + heights[mid]) / 2
        : heights[mid];
  }, [vsState.enabled]);

  // Scroll listener — also runs immediately to account for any initial scroll.
  useLayoutEffect(() => {
    if (!vsState.enabled) {
      return undefined;
    }
    const listEl = ref.current;
    if (!listEl) {
      return undefined;
    }
    const onScroll = () => {
      const median = medianHeightRef.current;
      const itemsPerView = Math.ceil(listEl.clientHeight / median);
      const firstVisible = Math.floor(listEl.scrollTop / median);
      const newStart = firstVisible > VS_BUFFER ? firstVisible - VS_BUFFER : 0;
      const newEnd = firstVisible + itemsPerView + VS_BUFFER;
      setVsState((prev) => ({ ...prev, start: newStart, end: newEnd }));
    };
    onScroll();
    listEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      listEl.removeEventListener("scroll", onScroll);
    };
  }, [vsState.enabled]);

  return (
    <Box
      id={id}
      maxHeight={maxHeight}
      {...rest}
      ref={ref}
      baseClassName="navi_suggestion_list"
      styleCSSVars={SuggestionListStyleCSSVars}
    >
      <SuggestionListbox
        ref={listboxRef}
        listRef={ref}
        vsState={vsState}
        medianHeightRef={medianHeightRef}
        uiAction={uiAction}
        highlight={highlight}
        emptyState={emptyState}
      >
        {children}
      </SuggestionListbox>
    </Box>
  );
};
const SuggestionListboxContext = createContext(null);
const VirtualScrollContext = createContext(null);
// The <ul role="listbox"> with top and bottom filler <li>s that maintain the
// total scroll height when virtual scroll is active. Piloted by
// SuggestionListControlled which detects max-height and sets vsState.
const SuggestionListbox = ({
  ref,
  listRef,
  vsState,
  medianHeightRef,
  uiAction,
  highlight,
  emptyState,
  children,
}) => {
  const ItemTrackerProvider = useSuggestionItemTrackerProvider();
  const [pointedValue, setPointedValue] = useState(null);
  const pointedValueRef = useRef(null);
  pointedValueRef.current = pointedValue;
  const pointedByKeyboardRef = useRef(false);

  const onPointedBy = (value, event) => {
    pointedByKeyboardRef.current = event.type === "navi_list_navigate";
    setPointedValue(value);
  };
  const select = (value, event) => {
    uiAction?.(value, event);
  };

  // Update filler heights directly in a layout effect to avoid the extra
  // re-render that a totalItems state would cause. We only update when
  // items.length > 0 — when Preact bails out on Suggestion wrappers the
  // tracker resets but children don't re-register, so items.length === 0;
  // in that case we keep the last known heights.
  const totalItemsRef = useRef(0);
  const fillerTopRef = useRef(null);
  const fillerBottomRef = useRef(null);
  useLayoutEffect(() => {
    const count = ItemTrackerProvider.items.length;
    if (count > 0) {
      totalItemsRef.current = count;
    }
    const totalItems = totalItemsRef.current;
    const median = medianHeightRef.current;
    const topHidden = vsState.start;
    const bottomHidden =
      totalItems > vsState.end ? totalItems - vsState.end : 0;
    if (fillerTopRef.current) {
      fillerTopRef.current.style.height = `${Math.round(topHidden * median)}px`;
    }
    if (fillerBottomRef.current) {
      fillerBottomRef.current.style.height = `${Math.round(bottomHidden * median)}px`;
    }
  }, [vsState.start, vsState.end]);

  useLayoutEffect(() => {
    if (!CSS.highlights) {
      return undefined;
    }
    if (!highlight) {
      CSS.highlights.delete("navi-suggestion-match");
      return undefined;
    }
    const listEl = listRef.current;
    if (!listEl) {
      return undefined;
    }
    const ranges = [];
    const lowerHighlight = highlight.toLowerCase();
    for (const suggestionEl of listEl.querySelectorAll("[role='option']")) {
      const walker = document.createTreeWalker(
        suggestionEl,
        NodeFilter.SHOW_TEXT,
      );
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent;
        const lowerText = text.toLowerCase();
        let index = lowerText.indexOf(lowerHighlight);
        while (index !== -1) {
          const range = new Range();
          range.setStart(node, index);
          range.setEnd(node, index + highlight.length);
          ranges.push(range);
          index = lowerText.indexOf(lowerHighlight, index + 1);
        }
      }
    }
    if (ranges.length === 0) {
      CSS.highlights.delete("navi-suggestion-match");
    } else {
      CSS.highlights.set("navi-suggestion-match", new Highlight(...ranges));
    }
    return () => {
      CSS.highlights.delete("navi-suggestion-match");
    };
  }, [highlight, children]);

  const suggestionContext = {
    pointedValue,
    onHover: onPointedBy,
    pointedByKeyboardRef,
    onSelect: select,
  };

  return (
    <Box
      ref={ref}
      as="ul"
      role="listbox"
      baseClassName="navi_suggestion_listbox"
      // Listen for commands dispatched by SuggestionListStandalone (keyboard)
      // or SuggestionListWithPopover (external events).
      onnavi_list_navigate={(e) => {
        const { direction, event = e } = e.detail;
        const values = ItemTrackerProvider.items
          .filter((item) => !item.hidden)
          .map((item) => item.value);
        if (values.length === 0) {
          return;
        }
        const current = pointedValueRef.current;
        if (direction === "down") {
          const idx = current === null ? -1 : values.indexOf(current);
          onPointedBy(values[idx < values.length - 1 ? idx + 1 : idx], event);
        } else if (direction === "up") {
          const idx = current === null ? -1 : values.indexOf(current);
          onPointedBy(values[idx > 0 ? idx - 1 : 0], event);
        } else if (direction === "first") {
          onPointedBy(values[0], event);
        } else if (direction === "last") {
          onPointedBy(values[values.length - 1], event);
        }
      }}
      onnavi_list_confirm={(e) => {
        const current = pointedValueRef.current;
        if (current === null) {
          return;
        }
        select(current, e);
      }}
      onnavi_list_clear={(e) => {
        onPointedBy(null, e);
      }}
    >
      <li
        ref={fillerTopRef}
        className="navi_suggestion_listbox_filler"
        data-top=""
        aria-hidden="true"
      />
      <VirtualScrollContext.Provider value={vsState}>
        <SuggestionListboxContext.Provider value={suggestionContext}>
          <ItemTrackerProvider>{children}</ItemTrackerProvider>
        </SuggestionListboxContext.Provider>
      </VirtualScrollContext.Provider>

      {emptyState && (
        <li className="navi_suggestion_listbox_empty">{emptyState}</li>
      )}
      <li
        ref={fillerBottomRef}
        className="navi_suggestion_listbox_filler"
        aria-hidden="true"
      />
    </Box>
  );
};

const SUGGESTION_PSEUDO_CLASSES = [":-navi-pointed", ":-navi-selected"];
const SUGGESTION_PSEUDO_ELEMENTS = ["::highlight"];
// Thin wrapper: tracks the suggestion (so all items register with ItemTracker
// regardless of virtual scroll), then bails out early outside the visible window.
export const Suggestion = ({ value, hidden, ...rest }) => {
  const idDefault = useId();
  const id = rest.id || idDefault;
  const index = useTrackSuggestion({ id, value, hidden });
  const vsCtx = useContext(VirtualScrollContext);
  if (vsCtx && vsCtx.enabled) {
    if (index < vsCtx.start || index >= vsCtx.end) {
      return null;
    }
  }
  return <SuggestionConcrete value={value} hidden={hidden} id={id} {...rest} />;
};
const SuggestionConcrete = ({
  value,
  selected,
  hidden,
  id,
  children,
  ...rest
}) => {
  import.meta.css = css;

  const { pointedValue, onHover, pointedByKeyboardRef, onSelect } = useContext(
    SuggestionListboxContext,
  );

  const isPointed = pointedValue === value;
  const suggestionRef = useRef(null);

  useEffect(() => {
    const suggestionEl = suggestionRef.current;
    if (isPointed && suggestionEl && pointedByKeyboardRef.current) {
      suggestionEl.scrollIntoView({ block: "nearest" });
    }
  }, [isPointed]);

  return (
    <Box
      as="li"
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
        if (!hidden) {
          onHover(value, e);
        }
      }}
      onMouseLeave={(e) => {
        if (!hidden) {
          onHover(null, e);
        }
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
    <li role="presentation" {...rest}>
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
    </li>
  );
};
