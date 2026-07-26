import { dispatchCustomEvent } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useId, useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { useItemTracker } from "../../utils/item_tracker/use_item_tracker.js";
import { useDisplayedLayoutEffect } from "../../utils/use_displayed_layout_effect.js";
import {
  ListItemSelectableResolver,
  ListSelectableResolver,
} from "./list_selectable.jsx";

/*
 * Wheel — a selectable list rendered as an iOS-style scroll picker. A short
 * viewport shows the selected value in the middle with the neighbouring values
 * faded above/below (or left/right when `horizontal`). The selected value is
 * whichever item is closest to the center; the user changes it by scrolling,
 * dragging, clicking a neighbour, or with the arrow keys.
 *
 * WHAT IS REUSED. All selection/keyboard/action/form wiring comes verbatim from
 * the selectable List (ListSelectableResolver + ListItemSelectableResolver):
 * value/defaultValue, action/uiAction, the focus group over the hidden radio
 * inputs, and the navi_request_select/nav/activate protocol. Wheel only adds the
 * scroll-picker rendering and these scroll behaviours:
 *   - scroll settles        → select the centered item
 *   - focus (arrows/tab)     → scroll the focused item to center
 *   - external value change  → scroll the selected item to center
 *
 * NO ROVING TABINDEX. The hidden radios share the group `name`, so they are a
 * real native radio group: the browser already Tab-focuses the checked (=
 * centered) one. We deliberately do NOT manage tabindex ourselves — an earlier
 * attempt did and it fought the native behaviour. If Tab ever lands on the wrong
 * item, fix the native grouping/visibility, not this file.
 *
 * LOOP. With `loop`, the list wraps endlessly. We render `visibleCount` inert
 * proxy rows on each side — the last N values before, the first N after — just
 * enough to fill the viewport at the edges. On every scroll we fold the center
 * back into the real-items band by whole real-list extents; seamless because a
 * proxy shows the exact value the real row one extent away would. The proxy
 * labels come from a Wheel.Item tracker (see WheelItemTrackerContext), NOT from
 * walking children — children may be wrapped in context providers/fragments.
 *
 * ORIENTATION. Everything above is axis-agnostic: helpers read the main axis via
 * accessors (top/height vs left/width) chosen from `horizontal`, and the CSS has
 * a [data-horizontal] variant.
 */

const css = /* css */ `
  .navi_wheel_container {
    --wheel-item-height: 2.4em;
    --wheel-item-width: 3.5ch;
    --wheel-visible-count: 3;
    --wheel-color: light-dark(#111, #eee);
    --wheel-color-faded: light-dark(#bbb, #555);

    position: relative; /* for the loading outline */
    display: inline-flex;
    color: var(--wheel-color-faded);
    font-size: var(--navi-control-font-size);
    font-family: var(--navi-control-font-family);
    border-radius: 6px;

    /* Keyboard interaction focus-visibles a hidden radio inside; show the focus
       outline on the whole column, not just the selected row. [data-focus-visible]
       lets a caller force the state (e.g. in a demo). */
    &:has([navi-selectable-real-input]:focus-visible),
    &[data-focus-visible] {
      outline: var(--navi-focus-outline-width, 2px) solid
        var(--navi-focus-outline-color, light-dark(#4a90d9, #6ab0ff));
      outline-offset: 2px;
    }

    &[data-readonly] {
      --wheel-color: light-dark(#555, #aaa);
    }
    &[data-disabled] {
      opacity: 0.5;
      pointer-events: none;
    }
  }

  .navi_wheel_viewport {
    position: relative;
    -webkit-overflow-scrolling: touch;
    /* No visible scrollbar */
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  /* type is informative metadata; a couple of types get a rendering hint.
     "integer" wants figures to line up column-to-column across rows. */
  .navi_wheel_container[data-wheel-type="integer"] {
    font-variant-numeric: tabular-nums;
  }

  .navi_wheel_list {
    display: flex;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .navi_wheel_item {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    color: var(--wheel-color-faded);
    text-align: center;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    scroll-snap-align: center;
    scroll-snap-stop: always;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.15s ease;

    &[navi-selectable-area-all] {
      pointer-events: none;

      [navi-selectable-real-input] {
        z-index: 0;
        outline: none;
        opacity: 0;
        clip-path: none;
        cursor: pointer;
        pointer-events: auto;
      }
    }

    &[data-wheel-current] {
      color: var(--wheel-color);
      font-weight: 600;
      /* Clicking the current value re-selects what is already selected —
         nothing happens, so don't advertise it as clickable. */
      cursor: default;

      [navi-selectable-real-input] {
        cursor: default;
      }
    }

    &[data-disabled] {
      opacity: 0.4;
      cursor: default;
    }
  }

  /* ── Vertical (default) ─────────────────────────────────────────────────── */
  .navi_wheel_container:not([data-horizontal]) {
    .navi_wheel_viewport {
      height: calc(var(--wheel-item-height) * var(--wheel-visible-count));
      -webkit-mask-image: var(--wheel-fade-y);
      mask-image: var(--wheel-fade-y);
      overflow-x: hidden;
      overflow-y: auto;
      scroll-snap-type: y mandatory;
    }
    .navi_wheel_list {
      /* Blank space so the first and last items can reach the center row. */
      padding-block: calc(
        var(--wheel-item-height) * (var(--wheel-visible-count) - 1) / 2
      );
      flex-direction: column;
      &[data-loop] {
        padding-block: 0;
      }
    }
    .navi_wheel_item {
      height: var(--wheel-item-height);
      padding-inline: var(--wheel-item-padding-x, 0.5ch);
    }
  }

  /* ── Horizontal ─────────────────────────────────────────────────────────── */
  .navi_wheel_container[data-horizontal] {
    .navi_wheel_viewport {
      width: calc(var(--wheel-item-width) * var(--wheel-visible-count));
      -webkit-mask-image: var(--wheel-fade-x);
      mask-image: var(--wheel-fade-x);
      overflow-x: auto;
      overflow-y: hidden;
      scroll-snap-type: x mandatory;
    }
    .navi_wheel_list {
      padding-inline: calc(
        var(--wheel-item-width) * (var(--wheel-visible-count) - 1) / 2
      );
      flex-direction: row;
      &[data-loop] {
        padding-inline: 0;
      }
    }
    .navi_wheel_item {
      width: var(--wheel-item-width);
      padding-block: var(--wheel-item-padding-x, 0.5ch);
    }
  }

  .navi_wheel_container {
    --wheel-fade-y: linear-gradient(
      to bottom,
      transparent 0%,
      #000 32%,
      #000 68%,
      transparent 100%
    );
    --wheel-fade-x: linear-gradient(
      to right,
      transparent 0%,
      #000 32%,
      #000 68%,
      transparent 100%
    );
  }

  /* ── WheelGroup ─────────────────────────────────────────────────────────────
     Several wheels with separators (e.g. ":") between them. The separator column
     keeps its natural content width (small for ":", wide for a word like
     "hours") and is not scrollable. The spacing between a wheel and a separator
     is provided by the wheel: its scrollable viewport is padded by
     --wheel-spacing, so scrolling/dragging in that gap scrolls the wheel — only
     the small separator glyph itself is a dead zone, which keeps the UX good. */
  .navi_wheel_group {
    --wheel-spacing: 0.5ch;

    display: inline-flex;
    align-items: center;
  }
  .navi_wheel_group:not([data-horizontal]) .navi_wheel_viewport {
    padding-inline: var(--wheel-spacing);
  }
  .navi_wheel_group[data-horizontal] {
    flex-direction: column;
    align-items: center;

    .navi_wheel_viewport {
      padding-block: var(--wheel-spacing);
    }
  }
  .navi_wheel_group_separator {
    display: flex;
    align-items: center;
    align-self: stretch;
    justify-content: center;
    color: var(--wheel-color, light-dark(#111, #eee));
    font-weight: 600;
    font-family: var(--navi-control-font-family);
    white-space: nowrap;
    user-select: none;
  }
`;

// Wheel.Item registers its {value, label} here so WheelUI knows the full ordered
// list of items regardless of how children are wrapped (providers, fragments…).
// indexRef gives each item its position: WheelUI resets it to 0 every render and
// each item reads-and-increments it as it renders, in document order.
const WheelItemTrackerContext = createContext(null);

const WheelFirstResolver = (props) => {
  const Next = useNextResolver();
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const idDefault = useId();
  // The selectable layer looks the group's UI state controller up by this id
  // (getUIStateControllerById), so it must be stable and always present.
  props.id = props.id || idDefault;
  // Selection is the whole point of a wheel, so it is on by default (unlike
  // List which requires an explicit `selectable`). Pass selectable={false} to
  // get a purely presentational scroller.
  props.selectable = props.selectable ?? true;
  // Restrict the focus group to the wheel's single axis.
  props.focusGroupDirection =
    props.focusGroupDirection || (props.horizontal ? "x" : "y");
  // When looping, arrowing past an end wraps focus around so the keyboard
  // follows the same endless motion as scrolling.
  props.focusGroupWrap =
    props.focusGroupWrap ??
    (props.loop ? (props.horizontal ? "x" : "y") : undefined);

  return <Next {...props} />;
};

/**
 * Wheel — a selectable list rendered as a scroll picker (see the file header).
 *
 * @type {import("preact").FunctionComponent<{
 *   value?: any,
 *   defaultValue?: any,
 *   action?: (value: any) => void,
 *   uiAction?: (value: any) => void,
 *   selectable?: boolean,
 *   visibleCount?: number,
 *   itemHeight?: number | string,
 *   itemWidth?: number | string,
 *   loop?: boolean,
 *   horizontal?: boolean,
 *   type?: string,
 *   name?: string,
 *   required?: boolean,
 *   readOnly?: boolean,
 *   disabled?: boolean,
 *   loading?: boolean,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {number} [props.visibleCount=3] - Odd number of rows visible in the viewport (the center one is the selection).
 * @param {number|string} [props.itemHeight] - Main-axis size of a row when vertical (number = px). Defaults to the CSS var (2.4em).
 * @param {number|string} [props.itemWidth] - Main-axis size of a cell when horizontal (number = px). Defaults to the CSS var (3.5ch).
 * @param {boolean} [props.loop] - Wrap around endlessly: past the last value the first reappears (and vice-versa).
 * @param {boolean} [props.horizontal] - Lay the wheel out horizontally (scrolls left/right) instead of vertically.
 * @param {string} [props.type] - Informative value kind (e.g. "integer", "day"). Used only for rendering hints, like tabular figures for "integer".
 */
export const Wheel = createComponentResolver([
  WheelFirstResolver,
  ListSelectableResolver,
  WheelUI,
]);

function WheelUI(props) {
  import.meta.css = css;
  const {
    ref,
    visibleCount = 3,
    itemHeight,
    itemWidth,
    loop,
    horizontal,
    type,
    style,
    basePseudoState,
    children,
    ...rest
  } = props;
  const isHorizontal = Boolean(horizontal);
  const isLoop = Boolean(loop);
  const loading = basePseudoState ? basePseudoState[":-navi-loading"] : false;
  const readOnly = basePseudoState ? basePseudoState[":read-only"] : false;
  const disabled = basePseudoState ? basePseudoState[":disabled"] : false;
  // Scroll/arrows/clicks must not change a readonly or disabled wheel — the
  // controlled value stays authoritative and any scroll springs back to it.
  const interactive = !readOnly && !disabled;

  // Collect every Wheel.Item's {value, label} in order, robustly (children may
  // be wrapped). loopClones drives the proxy rows and the wrap math.
  const tracker = useItemTracker();
  const indexRef = useRef(0);
  indexRef.current = 0;
  const trackerContextRef = useRef(null);
  if (!trackerContextRef.current) {
    trackerContextRef.current = { tracker, indexRef };
  }
  const trackedItems = tracker.itemsSignal.value;
  const loopClones = isLoop
    ? trackedItems.map((item) => ({ value: item.value, label: item.label }))
    : [];

  // The id of the item currently sitting in the center. Guards the effects so an
  // external value change (or the initial mount) scrolls the selection into
  // place, while our own scroll-driven selection does not scroll a second time.
  const centeredIdRef = useRef(null);

  const styleWithVars = {
    "--wheel-visible-count": visibleCount,
    ...(itemHeight === undefined
      ? {}
      : {
          "--wheel-item-height":
            typeof itemHeight === "number" ? `${itemHeight}px` : itemHeight,
        }),
    ...(itemWidth === undefined
      ? {}
      : {
          "--wheel-item-width":
            typeof itemWidth === "number" ? `${itemWidth}px` : itemWidth,
        }),
    ...style,
  };

  // Main-axis accessors — pick top/height or left/width from the orientation.
  const readScroll = (vp) => (isHorizontal ? vp.scrollLeft : vp.scrollTop);
  const writeScroll = (vp, pos, behavior) =>
    vp.scrollTo(
      isHorizontal ? { left: pos, behavior } : { top: pos, behavior },
    );
  const addScroll = (vp, delta) => {
    if (isHorizontal) {
      vp.scrollLeft += delta;
    } else {
      vp.scrollTop += delta;
    }
  };
  const viewportMain = (vp) =>
    isHorizontal ? vp.clientWidth : vp.clientHeight;
  const itemMainStart = (el) => (isHorizontal ? el.offsetLeft : el.offsetTop);
  const itemMainSize = (el) =>
    isHorizontal ? el.offsetWidth : el.offsetHeight;

  const getViewport = () => ref.current?.querySelector(".navi_wheel_viewport");

  const findCenteredItem = (viewportEl) => {
    const items = viewportEl.querySelectorAll("[navi-list-item-real]");
    const center = readScroll(viewportEl) + viewportMain(viewportEl) / 2;
    let closest = null;
    let closestDistance = Infinity;
    for (const item of items) {
      const itemCenter = itemMainStart(item) + itemMainSize(item) / 2;
      const distance = Math.abs(itemCenter - center);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = item;
      }
    }
    return closest;
  };

  const centerItem = (viewportEl, itemEl, behavior) => {
    const base =
      itemMainStart(itemEl) -
      (viewportMain(viewportEl) - itemMainSize(itemEl)) / 2;
    let target = base;
    // In loop mode the same value also lives in the proxy buffers, so a real
    // item can be centered at base ± k·realSpan. Pick the copy nearest the
    // current scroll so movement stays minimal and continuous — e.g. arrowing
    // off the last value scrolls one step onto the "first" proxy (which the wrap
    // then normalises) instead of jumping to the far end.
    if (isLoop && loopClones.length) {
      const realSpan = itemMainSize(itemEl) * loopClones.length;
      if (realSpan > 0) {
        const copies = Math.round((readScroll(viewportEl) - base) / realSpan);
        target = base + copies * realSpan;
      }
    }
    writeScroll(viewportEl, target, behavior);
  };

  // Fold the viewport center back into the real-items band. The real items own
  // [bufferSpan, bufferSpan + realSpan); a proxy `realSpan` away shows the exact
  // same value, so shifting by whole realSpans is invisible and makes the wheel
  // spin endlessly. Runs on every scroll so even a long fling folds back.
  const wrapScrollIntoRealBand = (viewportEl) => {
    const realItem = viewportEl.querySelector("[navi-list-item-real]");
    if (!realItem || !loopClones.length) {
      return;
    }
    const itemSize = itemMainSize(realItem);
    const realSpan = itemSize * loopClones.length;
    if (realSpan === 0) {
      return;
    }
    const bufferSpan = itemSize * visibleCount;
    const center = readScroll(viewportEl) + viewportMain(viewportEl) / 2;
    if (center >= bufferSpan && center < bufferSpan + realSpan) {
      return;
    }
    const offsetInBand =
      (((center - bufferSpan) % realSpan) + realSpan) % realSpan;
    addScroll(viewportEl, bufferSpan + offsetInBand - center);
  };

  // A proxy was clicked — select (and center) the real item it stands in for.
  const handleCloneClick = (index) => {
    const el = ref.current;
    const viewportEl = el.querySelector(".navi_wheel_viewport");
    const realItems = viewportEl.querySelectorAll("[navi-list-item-real]");
    const target = realItems[index];
    if (!target) {
      return;
    }
    const input = target.querySelector("[navi-selectable-real-input]");
    if (!input || !input.checked) {
      dispatchCustomEvent(el, "navi_request_select", {
        event: new CustomEvent("navi_wheel_clone_click"),
        id: target.id,
      });
    }
    centerItem(viewportEl, target, "smooth");
  };

  const getSelectedItem = (viewportEl) => {
    const checkedInput = viewportEl.querySelector(
      "[navi-selectable-real-input]:checked",
    );
    return checkedInput
      ? checkedInput.closest("[navi-list-item-real]")
      : viewportEl.querySelector("[navi-list-item-real]");
  };

  // Sync the center with the current selection (checked radio) — used on first
  // display and whenever the controlled value changes from outside.
  const syncCenterToSelection = (viewportEl, behavior) => {
    const selectedItem = getSelectedItem(viewportEl);
    if (!selectedItem) {
      return;
    }
    if (selectedItem.id === centeredIdRef.current) {
      return;
    }
    centeredIdRef.current = selectedItem.id;
    updateCurrentMarker(viewportEl, selectedItem);
    centerItem(viewportEl, selectedItem, behavior);
  };

  // Initial centering — deferred until the wheel is on screen so scrollTo isn't
  // a no-op inside a closed popover/dialog.
  useDisplayedLayoutEffect(
    ref,
    (el) => {
      syncCenterToSelection(el.querySelector(".navi_wheel_viewport"), "auto");
    },
    [],
  );

  // React to controlled value changes coming from outside.
  useLayoutEffect(() => {
    const viewportEl = getViewport();
    if (!viewportEl || viewportEl.offsetParent === null) {
      return;
    }
    syncCenterToSelection(viewportEl, "auto");
  });

  // Scroll handling: keep the center marker live, wrap in loop mode, and select
  // the centered item once scrolling settles.
  useLayoutEffect(() => {
    const el = ref.current;
    const viewportEl = el.querySelector(".navi_wheel_viewport");
    let rafId = null;
    let settleTimer = null;

    const onScroll = () => {
      if (isLoop) {
        wrapScrollIntoRealBand(viewportEl);
      }
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateCurrentMarker(viewportEl, findCenteredItem(viewportEl));
        });
      }
      clearTimeout(settleTimer);
      settleTimer = setTimeout(onSettle, 120);
    };
    const onSettle = () => {
      const centered = findCenteredItem(viewportEl);
      if (!centered) {
        return;
      }
      centeredIdRef.current = centered.id;
      const input = centered.querySelector("[navi-selectable-real-input]");
      if (input && (input.checked || input.disabled)) {
        return;
      }
      dispatchCustomEvent(el, "navi_request_select", {
        event: new CustomEvent("navi_wheel_settle"),
        id: centered.id,
      });
    };

    viewportEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      clearTimeout(settleTimer);
      viewportEl.removeEventListener("scroll", onScroll);
    };
  }, [isLoop, isHorizontal]);

  // Focus (arrow keys, tab, click) centers the focused item.
  useLayoutEffect(() => {
    const el = ref.current;
    const viewportEl = el.querySelector(".navi_wheel_viewport");
    const onFocusIn = (e) => {
      const input = e.target.closest("[navi-selectable-real-input]");
      if (!input) {
        return;
      }
      const itemEl = input.closest("[navi-list-item-real]");
      if (!itemEl) {
        return;
      }
      centeredIdRef.current = itemEl.id;
      updateCurrentMarker(viewportEl, itemEl);
      centerItem(viewportEl, itemEl, "smooth");
    };
    el.addEventListener("focusin", onFocusIn);
    return () => {
      el.removeEventListener("focusin", onFocusIn);
    };
  }, [isHorizontal]);

  return (
    <Box
      {...rest}
      ref={ref}
      baseClassName="navi_wheel_container"
      data-horizontal={isHorizontal ? "" : undefined}
      pseudoClasses={WHEEL_PSEUDO_CLASSES}
      basePseudoState={basePseudoState}
      style={styleWithVars}
    >
      <LoadingOutline loading={loading} inset={-1} />
      <div className="navi_wheel_viewport">
        <ul className="navi_wheel_list" data-loop={isLoop ? "" : undefined}>
          {isLoop
            ? renderClones(
                getLoopBufferItems(loopClones, visibleCount, "before"),
                "before",
                handleCloneClick,
              )
            : null}
          <WheelItemTrackerContext.Provider value={trackerContextRef.current}>
            {children}
          </WheelItemTrackerContext.Provider>
          {isLoop
            ? renderClones(
                getLoopBufferItems(loopClones, visibleCount, "after"),
                "after",
                handleCloneClick,
              )
            : null}
        </ul>
      </div>
    </Box>
  );
}
const WHEEL_PSEUDO_CLASSES = [
  ":focus-within",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];

// The `visibleCount` proxy rows to render on one side of the real items:
//   - "before" → the last N values (…, len-2, len-1) so the row just before the
//     first real item shows the last value (wrap: … 44 45 | 00 …).
//   - "after"  → the first N values (0, 1, …) so the row just after the last
//     real item shows the first value (… 45 | 00 01 …).
// Each descriptor keeps the real value index so a proxy click maps back to it.
const getLoopBufferItems = (clones, visibleCount, side) => {
  const count = clones.length;
  const items = [];
  if (count === 0) {
    return items;
  }
  for (let position = 0; position < visibleCount; position++) {
    const index =
      side === "before"
        ? (((count - visibleCount + position) % count) + count) % count
        : position % count;
    items.push({ label: clones[index].label, index });
  }
  return items;
};

// Inert visual proxies of the real items used for seamless looping. They carry
// no radio input, are hidden from assistive tech, and clicking one selects the
// real item it stands in for (see handleCloneClick).
const renderClones = (bufferItems, position, onCloneClick) => {
  return bufferItems.map((item, offset) => (
    <li
      key={`${position}_${offset}`}
      className="navi_wheel_item navi_wheel_item_clone"
      aria-hidden="true"
      onClick={() => onCloneClick(item.index)}
    >
      {item.label}
    </li>
  ));
};

const updateCurrentMarker = (viewportEl, currentItem) => {
  const previous = viewportEl.querySelector("[data-wheel-current]");
  if (previous && previous !== currentItem) {
    previous.removeAttribute("data-wheel-current");
  }
  if (currentItem) {
    currentItem.setAttribute("data-wheel-current", "");
  }
};

const WheelItemFirstResolver = (props) => {
  const Next = useNextResolver();
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;
  const idDefault = useId();
  props.id = props.id || idDefault;
  props.selectable = props.selectable ?? true;

  // Report this item's value + label to the wheel (used to build loop proxies).
  // Wheel.Item must live inside a Wheel, so the context is always present.
  const trackerContext = useContext(WheelItemTrackerContext);
  const index = trackerContext.indexRef.current++;
  trackerContext.tracker.useTrackItem({
    id: props.id,
    index,
    value: props.value,
    label: props.children,
  });

  return <Next {...props} />;
};

const WheelItemUI = (props) => {
  const { ref, id, children, ...rest } = props;

  return (
    <Box
      as="li"
      baseClassName="navi_wheel_item"
      id={id}
      navi-list-item-real=""
      pseudoClasses={WHEEL_ITEM_PSEUDO_CLASSES}
      {...rest}
      index={undefined}
      selected={undefined}
      matchInfo={undefined}
      ref={ref}
    >
      {children}
    </Box>
  );
};
const WHEEL_ITEM_PSEUDO_CLASSES = [
  ":hover",
  ":disabled",
  ":read-only",
  ":focus-within",
  ":-navi-selected",
];

/**
 * Wheel.Item — a selectable value in a Wheel. Must be used inside <Wheel>.
 *
 * Reuses the selectable List item behaviour (hidden radio + click/keyboard
 * selection). The children are the label shown in the row.
 *
 * @type {import("preact").FunctionComponent<{
 *   value: any,
 *   selected?: boolean,
 *   selectable?: boolean,
 *   readOnly?: boolean,
 *   disabled?: boolean,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 */
export const WheelItem = createComponentResolver([
  WheelItemFirstResolver,
  ListItemSelectableResolver,
  WheelItemUI,
]);
Wheel.Item = WheelItem;

/**
 * WheelGroup — lays out several Wheels side by side with separators between
 * them (e.g. a "HH : MM : SS" time picker, or "9 hours 30 minutes").
 *
 * Put <Wheel> and <WheelGroup.Separator> as direct children. Separators take
 * their natural content width; the scrollable spacing around them is provided by
 * the wheels (--wheel-spacing padding on their viewport), so scrolling in the
 * gap scrolls the wheel — only the small separator glyph is a dead zone.
 *
 * @type {import("preact").FunctionComponent<{
 *   spacing?: number | string,
 *   horizontal?: boolean,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {number|string} [props.spacing] - Scrollable gap each wheel adds toward its neighbours (number = px; default 0.5ch).
 * @param {boolean} [props.horizontal] - Stack the (horizontal) wheels vertically instead of in a row.
 */
export const WheelGroup = ({
  spacing,
  horizontal,
  className,
  style,
  children,
  ...rest
}) => {
  import.meta.css = css;
  const groupStyle = {
    ...(spacing === undefined
      ? {}
      : {
          "--wheel-spacing":
            typeof spacing === "number" ? `${spacing}px` : spacing,
        }),
    ...style,
  };
  return (
    <div
      {...rest}
      className={
        className ? `navi_wheel_group ${className}` : "navi_wheel_group"
      }
      data-horizontal={horizontal ? "" : undefined}
      style={groupStyle}
    >
      {children}
    </div>
  );
};
const WheelGroupSeparator = ({ children, ...rest }) => {
  return (
    <span {...rest} className="navi_wheel_group_separator" aria-hidden="true">
      {children}
    </span>
  );
};
WheelGroup.Separator = WheelGroupSeparator;
