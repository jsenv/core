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
import { createItemTracker } from "./item_tracker/item_tracker.jsx";

// Provided by SuggestionListCombo. When present, SuggestionListControlled
// uses it to inject index/hidden into Suggestion children automatically.
export const SuggestionFilterContext = createContext(null);
export const SuggestionMatchContext = createContext(null);

const [useSuggestionItemTrackerProvider, useTrackSuggestion] =
  createItemTracker({
    filter: (data) => !data.hidden,
  });

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
const VIRTUAL_SCROLL_BUFFER = 5; // extra items to render above and below the visible window

// Core: virtual scroll detection, scroll listener, median measurement, and the <Box>
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
  const [virtualScrollState, setVirtualScrollState] = useState({
    enabled: false,
    start: 0,
    end: VIRTUAL_SCROLL_BUFFER * 2,
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
    setVirtualScrollState({
      enabled: true,
      start: 0,
      end: VIRTUAL_SCROLL_BUFFER + itemsPerView + VIRTUAL_SCROLL_BUFFER,
    });
  }, [maxHeight]);

  // Measure real item height once, right after the first virtual scroll window renders.
  const medianHeightRef = useRef(MIN_ITEM_HEIGHT);
  useLayoutEffect(() => {
    if (!virtualScrollState.enabled) {
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
  }, [virtualScrollState.enabled]);

  // Scroll listener — also runs immediately to account for any initial scroll.
  useLayoutEffect(() => {
    if (!virtualScrollState.enabled) {
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
      const newStart =
        firstVisible > VIRTUAL_SCROLL_BUFFER
          ? firstVisible - VIRTUAL_SCROLL_BUFFER
          : 0;
      const newEnd = firstVisible + itemsPerView + VIRTUAL_SCROLL_BUFFER;
      setVirtualScrollState((prev) => ({
        ...prev,
        start: newStart,
        end: newEnd,
      }));
    };
    onScroll();
    listEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      listEl.removeEventListener("scroll", onScroll);
    };
  }, [virtualScrollState.enabled]);

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
        virtualScrollState={virtualScrollState}
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
// SuggestionListControlled which detects max-height and sets virtualScrollState.
const SuggestionListbox = ({
  ref,
  listRef,
  virtualScrollState,
  medianHeightRef,
  uiAction,
  highlight,
  emptyState,
  children,
}) => {
  // When a filter is active, set highlight to the filter text so the listbox
  // can highlight matching text.
  const filter = useContext(SuggestionFilterContext);
  if (highlight === undefined) {
    highlight = filter;
  }

  const ItemTrackerProvider = useSuggestionItemTrackerProvider();
  const [mousePointedValue, setMousePointedValue] = useState(null);
  const [keyboardPointedValue, setKeyboardPointedValue] = useState(null);
  // The anchor is the index we navigate FROM. Only keyboard nav and
  // select (click/enter) update it — mouse hover does not.
  const [anchorValue, setAnchorValue] = useState(null);
  const anchorValueRef = useRef(null);
  anchorValueRef.current = anchorValue;

  const onMouseHover = (value) => {
    setMousePointedValue(value);
  };
  const onKeyboardPoint = (value, event) => {
    event.preventDefault(); // prevent arrow keys from scrolling the page
    anchorValueRef.current = value; // update immediately so rapid keypresses read the correct anchor
    setKeyboardPointedValue(value);
    setAnchorValue(value);
  };
  const select = (value, event) => {
    setAnchorValue(value);
    uiAction?.(value, event);
  };

  const fillerTopRef = useRef(null);
  const fillerBottomRef = useRef(null);
  useLayoutEffect(() => {
    // items is a live array: by the time this effect fires (SuggestionListbox is
    // an ancestor of ItemTrackerProvider), all Suggestion commit/decommit effects
    // have already run (bottom-up order), so items.length is correct.
    const totalItems = ItemTrackerProvider.items.length;
    const median = medianHeightRef.current;
    const topHidden = virtualScrollState.start;
    const bottomHidden =
      totalItems > virtualScrollState.end
        ? totalItems - virtualScrollState.end
        : 0;
    if (fillerTopRef.current) {
      fillerTopRef.current.style.height = `${Math.round(topHidden * median)}px`;
    }
    if (fillerBottomRef.current) {
      fillerBottomRef.current.style.height = `${Math.round(bottomHidden * median)}px`;
    }
  });

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

  // Stable handler refs so the inline Preact event props (which re-create
  // their closure on every render) always read the latest state without
  // causing stale-closure bugs.
  const onNavigateRef = useRef(null);
  onNavigateRef.current = (e) => {
    const { direction, event = e } = e.detail;
    const values = ItemTrackerProvider.items.map((item) => item.value);
    if (values.length === 0) {
      return;
    }
    const current = anchorValueRef.current;
    if (direction === "down") {
      const idx = current === null ? -1 : values.indexOf(current);
      const value = values[idx < values.length - 1 ? idx + 1 : idx];
      onKeyboardPoint(value, event);
    } else if (direction === "up") {
      const idx = current === null ? -1 : values.indexOf(current);
      const value = values[idx > 0 ? idx - 1 : 0];
      onKeyboardPoint(value, event);
    } else if (direction === "first") {
      onKeyboardPoint(values[0], event);
    } else if (direction === "last") {
      onKeyboardPoint(values[values.length - 1], event);
    }
  };
  const onConfirmRef = useRef(null);
  onConfirmRef.current = () => {
    const current = anchorValueRef.current;
    if (current === null) {
      return;
    }
    uiAction?.(current);
  };
  const onClearRef = useRef(null);
  onClearRef.current = () => {
    setMousePointedValue(null);
    setKeyboardPointedValue(null);
    setAnchorValue(null);
  };

  const suggestionContext = {
    mousePointedValue,
    keyboardPointedValue,
    onHover: onMouseHover,
    onSelect: select,
  };

  // Preact's event diffing removes and re-adds listeners on re-render,
  // which breaks custom events. Use stable direct addEventListener instead.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    const onNavigate = (e) => onNavigateRef.current(e);
    const onConfirm = () => onConfirmRef.current();
    const onClear = () => onClearRef.current();
    el.addEventListener("navi_list_navigate", onNavigate);
    el.addEventListener("navi_list_confirm", onConfirm);
    el.addEventListener("navi_list_clear", onClear);
    return () => {
      el.removeEventListener("navi_list_navigate", onNavigate);
      el.removeEventListener("navi_list_confirm", onConfirm);
      el.removeEventListener("navi_list_clear", onClear);
    };
  }, []);

  return (
    <Box
      ref={ref}
      as="ul"
      role="listbox"
      baseClassName="navi_suggestion_listbox"
    >
      <li
        ref={fillerTopRef}
        className="navi_suggestion_listbox_filler"
        data-top=""
        aria-hidden="true"
      />
      <VirtualScrollContext.Provider value={virtualScrollState}>
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
export const Suggestion = ({ value, hidden, index: indexProp, ...rest }) => {
  const idDefault = useId();
  const id = rest.id || idDefault;
  // When inside SuggestionListCombo, compute hidden from the filter context
  // unless the caller explicitly passed hidden.
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
  const index = useTrackSuggestion(id, { id, value, hidden }, indexProp);
  const virtualScrollCtx = useContext(VirtualScrollContext);
  if (virtualScrollCtx && virtualScrollCtx.enabled) {
    if (
      index === -1 ||
      index < virtualScrollCtx.start ||
      index >= virtualScrollCtx.end
    ) {
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

  const { mousePointedValue, keyboardPointedValue, onHover, onSelect } =
    useContext(SuggestionListboxContext);

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
        if (hidden) {
          return;
        }
        onHover(value, e);
      }}
      onMouseLeave={(e) => {
        if (hidden) {
          return;
        }
        onHover(null, e);
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
