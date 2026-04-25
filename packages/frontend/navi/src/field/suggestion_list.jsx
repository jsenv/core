import { pickPositionRelativeTo, visibleRectEffect } from "@jsenv/dom";
import { createContext } from "preact";
import {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { Box, applySeparatorOnChildren } from "../box/box.jsx";
import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { createItemTracker } from "./item_tracker/item_tracker.jsx";

// Provided by SuggestionListCombo. When present, SuggestionListControlled
// uses it to inject index/hidden into Suggestion children automatically.
export const SuggestionFilterContext = createContext(null);
export const SuggestionMatchContext = createContext(null);
// Provided by SuggestionListCombo so SuggestionListbox uses the same stable id
// that the input's aria-controls points to.
export const ListboxIdContext = createContext(null);

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
  /* Virtual scroll fillers — must remain invisible.
     The browser may briefly flash them during scroll before the render window
     updates, so giving them a visible background would cause visual glitches. */
  .navi_suggestion_virtual_filler {
    height: 0px;
    list-style: none;
    /* background: pink; */
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
// forwards them as custom events to itself (navi_suggestion_list_* events),
// which SuggestionListControlled then re-dispatches to the internal listbox.
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

// When total rendered items exceeds renderBudget, a render window [start, end)
// is activated to cap the number of DOM nodes. Items outside the window return
// null. The window slides as the user scrolls, using actual DOM positions
// (getBoundingClientRect) to find the first visible item — no height estimation.
const RENDER_BUDGET_DEFAULT = 100;

// Core: render budget windowing + scroll listener + the <Box> scroll container
// + <SuggestionListbox>. Controlled by either SuggestionListStandalone or
// SuggestionListWithPopover.
const SuggestionListControlled = ({
  ref,
  listboxRef,
  uiAction,
  highlight,
  emptyState = "No results",
  children,
  maxHeight,
  renderBudget = RENDER_BUDGET_DEFAULT,
  itemHeightEstimation,
  itemHeightIsVariable = true,
  separator,
  ...rest
}) => {
  const ownId = useId();
  const id = rest.id ?? ownId;

  // ItemTrackerProvider is created here (above the scroll listener) so the
  // scroll handler can read ItemTrackerProvider.items.length to decide whether
  // to activate/deactivate the render window.
  const ItemTrackerProvider = useSuggestionItemTrackerProvider();

  // renderWindow: null = render all items; {start, end} when active.
  // Items outside [start, end) return null. The window slides on scroll.
  const [renderWindow, setRenderWindow] = useState(null);
  const renderWindowRef = useRef(null);
  renderWindowRef.current = renderWindow;

  // Refs to the invisible filler <li> elements above and below the rendered window.
  // Their heights represent the space occupied by items outside the window, making
  // scrollHeight equal to the full list height so the scrollbar is accurate.
  const topFillerRef = useRef(null);
  const bottomFillerRef = useRef(null);
  // Cached item height so we don't re-measure every scroll event.
  const measuredItemHeightRef = useRef(itemHeightEstimation ?? 0);

  // After every render, update filler heights to reflect the current window.
  // overflow-anchor: none prevents the browser from adjusting scrollTop when
  // filler heights change, so the user's scroll position stays stable.
  useLayoutEffect(() => {
    const totalItems = ItemTrackerProvider.items.length;
    const current = renderWindowRef.current;
    if (!current || totalItems <= renderBudget) {
      if (topFillerRef.current) {
        topFillerRef.current.style.height = "0px";
      }
      if (bottomFillerRef.current) {
        bottomFillerRef.current.style.height = "0px";
      }
      return;
    }
    const listEl = ref.current;
    if (!listEl) {
      return;
    }
    const options = listEl.querySelectorAll("[role='option']");
    if (options.length === 0) {
      return;
    }
    // Measure from first rendered option unless caller provided a fixed estimate.
    if (!itemHeightEstimation) {
      measuredItemHeightRef.current = options[0].getBoundingClientRect().height;
    }
    const itemHeight = measuredItemHeightRef.current;
    if (topFillerRef.current) {
      topFillerRef.current.style.height = `${current.start * itemHeight}px`;
    }
    if (bottomFillerRef.current) {
      bottomFillerRef.current.style.height = `${(totalItems - current.end) * itemHeight}px`;
    }
  });
  // Activate or deactivate the render window depending on item count.
  // Runs every render so it reacts to filter changes (items added/removed).
  useLayoutEffect(() => {
    const totalItems = ItemTrackerProvider.items.length;
    if (totalItems > renderBudget) {
      if (renderWindowRef.current === null) {
        setRenderWindow({ start: 0, end: renderBudget });
      }
    } else if (renderWindowRef.current !== null) {
      setRenderWindow(null);
    }
  });

  // Scroll listener — derives the window directly from scrollTop / itemHeight.
  // Fillers make scrollHeight = full list height, so scrollTop is an accurate
  // pixel offset into the virtual list. No amplification or virtual index needed.
  useLayoutEffect(() => {
    const listEl = ref.current;
    if (!listEl) {
      return undefined;
    }
    const onScroll = () => {
      const totalItems = ItemTrackerProvider.items.length;
      if (totalItems <= renderBudget) {
        return;
      }
      const current = renderWindowRef.current;
      if (!current) {
        return;
      }
      const scrollTop = listEl.scrollTop;

      let firstVisibleIndex;
      if (itemHeightIsVariable) {
        // For variable-height items, use elementFromPoint to find the first
        // visible option at the top edge of the list container.
        const listRect = listEl.getBoundingClientRect();
        const options = Array.from(listEl.querySelectorAll("[role='option']"));
        if (options.length === 0) {
          return;
        }
        // Scan from the top of the list downward until we hit an option or a filler.
        let hitEl = null;
        let hitFiller = null;
        for (let y = listRect.top + 1; y < listRect.bottom; y += 4) {
          const el = document.elementFromPoint(listRect.left + 1, y);
          if (!el || !listEl.contains(el)) {
            continue;
          }
          const opt = el.closest("[role='option']");
          if (opt) {
            hitEl = opt;
            break;
          }
          // Check if we hit a filler li (aria-hidden, no role).
          const filler = el.closest("li[aria-hidden]");
          if (filler) {
            hitFiller = filler;
            break;
          }
        }
        if (hitFiller) {
          // We hit a filler — fall back to scrollTop / itemHeight which gives
          // the correct proportional position within the filler zone.
          const itemHeight = measuredItemHeightRef.current;
          if (itemHeight === 0) {
            return;
          }
          firstVisibleIndex = Math.floor(scrollTop / itemHeight);
        } else {
          const relIndex = hitEl ? options.indexOf(hitEl) : 0;
          firstVisibleIndex = current.start + (relIndex === -1 ? 0 : relIndex);
        }
      } else {
        const itemHeight = measuredItemHeightRef.current;
        if (itemHeight === 0) {
          return;
        }
        // Derive first visible absolute index directly from scrollTop.
        // Fillers make scrollHeight = full list height, so this is exact for
        // uniform-height items.
        firstVisibleIndex = Math.floor(scrollTop / itemHeight);
      }

      const half = Math.floor(renderBudget / 2);
      let newStart = Math.max(0, firstVisibleIndex - half);
      let newEnd = Math.min(totalItems, newStart + renderBudget);
      if (newEnd === totalItems) {
        newStart = Math.max(0, totalItems - renderBudget);
      }

      if (current.start === newStart && current.end === newEnd) {
        return;
      }
      setRenderWindow({ start: newStart, end: newEnd });
    };
    listEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      listEl.removeEventListener("scroll", onScroll);
    };
  }, [renderBudget]);

  // Forward navi_suggestion_list_* events (dispatched by input or standalone keyboard
  // shortcuts) to the internal listbox as navi_list_* events.
  const forward = (customEventName) => (e) => {
    dispatchCustomEventToListbox(listboxRef, e, customEventName, e.detail);
  };

  return (
    <Box
      id={id}
      maxHeight={maxHeight}
      {...rest}
      ref={ref}
      baseClassName="navi_suggestion_list"
      styleCSSVars={SuggestionListStyleCSSVars}
      onnavi_suggestion_list_navigate={forward("navi_list_navigate")}
      onnavi_suggestion_list_confirm={forward("navi_list_confirm")}
      onnavi_suggestion_list_clear={forward("navi_list_clear")}
    >
      <SuggestionListbox
        ref={listboxRef}
        ItemTrackerProvider={ItemTrackerProvider}
        renderWindow={renderWindow}
        topFillerRef={topFillerRef}
        bottomFillerRef={bottomFillerRef}
        uiAction={uiAction}
        highlight={highlight}
        emptyState={emptyState}
        separator={separator}
      >
        {children}
      </SuggestionListbox>
    </Box>
  );
};
const SuggestionListboxContext = createContext(null);
// Carries the render window {start, end} (or null = render all) from
// SuggestionListControlled down to each Suggestion.
const RenderWindowContext = createContext(null);
const SuggestionListbox = ({
  ref,
  ItemTrackerProvider,
  renderWindow,
  topFillerRef,
  bottomFillerRef,
  uiAction,
  highlight,
  emptyState,
  separator,
  children,
}) => {
  // When a filter is active, set highlight to the filter text so the listbox
  // can highlight matching text.
  const filter = useContext(SuggestionFilterContext);
  if (highlight === undefined) {
    highlight = filter;
  }
  const listboxIdFromContext = useContext(ListboxIdContext);

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
    highlight,
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
      id={listboxIdFromContext}
      as="ul"
      role="listbox"
      baseClassName="navi_suggestion_listbox"
    >
      <li
        ref={topFillerRef}
        className="navi_suggestion_virtual_filler"
        // eslint-disable-next-line react/no-unknown-property
        navi-virtual-filler="top"
        aria-hidden
      />
      <RenderWindowContext.Provider value={renderWindow}>
        <SuggestionListboxContext.Provider value={suggestionContext}>
          <ItemTrackerProvider>
            {separator
              ? applySeparatorOnChildren(children, separator)
              : children}
          </ItemTrackerProvider>
        </SuggestionListboxContext.Provider>
      </RenderWindowContext.Provider>
      <li
        ref={bottomFillerRef}
        className="navi_suggestion_virtual_filler"
        // eslint-disable-next-line react/no-unknown-property
        navi-virtual-filler="bottom"
        aria-hidden
      />

      {emptyState && (
        <li className="navi_suggestion_listbox_empty">{emptyState}</li>
      )}
    </Box>
  );
};

// Module-level shared Highlight instance — all visible SuggestionConcrete
// components add/remove their own ranges to this single object.
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

const SUGGESTION_PSEUDO_CLASSES = [":-navi-pointed", ":-navi-selected"];
const SUGGESTION_PSEUDO_ELEMENTS = ["::highlight"];
// Thin wrapper: tracks the suggestion (so all items register with ItemTracker
// regardless of virtual scroll), then bails out early outside the visible window.
export const Suggestion = ({ value, hidden, ...rest }) => {
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
  const index = useTrackSuggestion(id, { id, value, hidden });
  const renderWindow = useContext(RenderWindowContext);
  if (hidden) {
    // Hidden items are never needed in the DOM — they are invisible to the user
    // and to assistive technology (aria-hidden). Skipping them here avoids
    // inflating the DOM when a filter reduces visible items while the render
    // window is inactive (e.g. typing "al" leaves 1 match but 199 hidden items
    // that would otherwise all render as display:none nodes).
    return null;
  }
  if (renderWindow !== null) {
    // Render budget is active: only render items inside the window [start, end).
    if (
      index === -1 ||
      index < renderWindow.start ||
      index >= renderWindow.end
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

  const {
    mousePointedValue,
    keyboardPointedValue,
    highlight,
    onHover,
    onSelect,
  } = useContext(SuggestionListboxContext);

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
