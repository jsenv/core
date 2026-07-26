import { dispatchCustomEvent } from "@jsenv/dom";
import { createContext, toChildArray } from "preact";
import { useContext, useId, useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { useDisplayedLayoutEffect } from "../../utils/use_displayed_layout_effect.js";
import {
  ListItemSelectableResolver,
  ListSelectableResolver,
} from "../list/list_selectable.jsx";

// Wheel is a selectable list rendered as an iOS-style scroll picker: a short
// viewport shows the selected value in the middle with the neighbouring values
// faded above and below. The selected value is whichever item sits closest to
// the vertical center — the user changes it by scrolling (wheel/drag), by
// clicking a neighbour, or with the arrow keys.
//
// All selection/keyboard/action wiring is reused verbatim from the selectable
// List (ListSelectableResolver + ListItemSelectableResolver): value/defaultValue,
// action/uiAction, the focus group over the hidden radio inputs, and the
// navi_request_select/nav/activate event protocol. Only the visual layer and
// the scroll-to-center behaviour are Wheel-specific:
//   - scroll settles      → select the centered item
//   - focus (arrows/tab)  → smooth-scroll the focused item to center
//   - external value change → instant-scroll the selected item to center

const css = /* css */ `
  .navi_wheel_container {
    --wheel-item-height: 2.4em;
    --wheel-visible-count: 3;
    --wheel-color: light-dark(#111, #eee);
    --wheel-color-faded: light-dark(#bbb, #555);

    display: inline-flex;
    color: var(--wheel-color-faded);
    font-size: var(--navi-control-font-size);
    font-family: var(--navi-control-font-family);
    border-radius: 6px;

    /* Keyboard interaction (arrows/Tab) focus-visibles a hidden radio inside;
       show the focus outline on the whole column, not just the selected row. */
    &:has([navi-selectable-real-input]:focus-visible) {
      outline: var(--navi-focus-outline-width, 2px) solid
        var(--navi-focus-outline-color, light-dark(#4a90d9, #6ab0ff));
      outline-offset: 2px;
    }

    &[data-disabled] {
      opacity: 0.5;
      pointer-events: none;
    }
  }

  .navi_wheel_viewport {
    position: relative;
    height: calc(var(--wheel-item-height) * var(--wheel-visible-count));
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
    /* Fade the top and bottom rows toward the edges */
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      #000 32%,
      #000 68%,
      transparent 100%
    );
    mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      #000 32%,
      #000 68%,
      transparent 100%
    );
    /* No visible scrollbar */
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .navi_wheel_list {
    margin: 0;
    padding: 0;
    /* Blank space so the first and last items can reach the center row */
    padding-block: calc(
      var(--wheel-item-height) * (var(--wheel-visible-count) - 1) / 2
    );
    list-style: none;

    /* In loop mode the surrounding clone copies already fill the edges, so no
       blank padding is needed (and it would break the copy-height wrap math). */
    &[data-loop] {
      padding-block: 0;
    }
  }

  .navi_wheel_item {
    position: relative;
    display: flex;
    height: var(--wheel-item-height);
    padding-inline: var(--wheel-item-padding-x, 0.5ch);
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
    transition:
      color 0.15s ease,
      transform 0.15s ease;

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
      /* Clicking the current value selects what is already selected — nothing
         happens, so don't advertise it as clickable. */
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

  /* A separator (e.g. ":") placed between wheels. It is a sibling of the wheel,
     so it spans the full wheel height and centers its content — that lands it on
     the center row, glyph-centered exactly like .navi_wheel_item does its digits.
     Relying on the parent row's align-items would only align boxes/baselines, not
     the center row. */
  .navi_wheel_item_decoration {
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: var(--navi-control-font-size);
    font-family: var(--navi-control-font-family);
  }

  /* WheelGroup lays out several wheels with separators (e.g. ":") between them.
     Each wheel touching a separator eats half of it via a negative margin, so
     the wheel's scrollable viewport — not the inert separator — occupies that
     half. Between two wheels the separator is eaten from both sides, costing
     zero net layout width: the number columns sit flush and the ":" floats on
     the seam. Because the separator is pointer-events:none, scrolling/dragging
     over the ":" is caught by whichever wheel viewport lies beneath (left half →
     left wheel, right half → right wheel) instead of scrolling the page. */
  .navi_wheel_group {
    --wheel-separator-width: 1ch;

    display: inline-flex;
    align-items: center;
  }
  .navi_wheel_group > .navi_wheel_container:has(+ .navi_wheel_group_separator) {
    margin-right: calc(-0.5 * var(--wheel-separator-width));
  }
  .navi_wheel_group > .navi_wheel_group_separator + .navi_wheel_container {
    margin-left: calc(-0.5 * var(--wheel-separator-width));
  }
  .navi_wheel_group_separator {
    --wheel-item-height: 2.4em;

    position: relative;
    z-index: 1;
    display: flex;
    width: var(--wheel-separator-width);
    align-items: center;
    /* Match the wheels' height so the glyph centers on the middle (selected) row */
    align-self: stretch;
    justify-content: center;
    color: light-dark(#111, #eee);
    font-weight: 600;
    font-size: var(--navi-control-font-size);
    font-family: var(--navi-control-font-family);
    /* Inert on top of the eaten halves — see the .navi_wheel_group note above */
    pointer-events: none;
    user-select: none;
  }
`;

// When loop is on, WheelFirstResolver reads the raw <Wheel.Item> children here
// (before the selectable layer wraps them) and passes down flat {label}
// descriptors. WheelUI renders those as inert visual clones above and below the
// real items — the ingredients for seamless wrapping — without registering
// duplicate radios/ids in the selectable machinery.
const WheelLoopClonesContext = createContext(null);

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
  // A wheel is a single vertical column — restrict the focus group to the Y axis.
  props.focusGroupDirection = props.focusGroupDirection || "y";
  // When looping, arrowing past an end wraps focus around (last → first) so the
  // keyboard follows the same endless motion as scrolling.
  props.focusGroupWrap = props.focusGroupWrap ?? (props.loop ? "y" : undefined);

  const { loop, children } = props;
  const clones = loop
    ? toChildArray(children)
        .filter((child) => child && typeof child === "object" && child.props)
        .map((child) => ({ label: child.props.children }))
    : null;

  return (
    <WheelLoopClonesContext.Provider value={clones}>
      <Next {...props} />
    </WheelLoopClonesContext.Provider>
  );
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
 *   loop?: boolean,
 *   name?: string,
 *   required?: boolean,
 *   readOnly?: boolean,
 *   disabled?: boolean,
 *   focusGroupWrap?: "y" | boolean,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {number} [props.visibleCount=3] - Odd number of rows visible in the viewport (the center one is the selection).
 * @param {number|string} [props.itemHeight] - Height of a single row (number = px). Defaults to the CSS var (2.4em).
 * @param {boolean} [props.loop] - Wrap around endlessly: past the last value the first reappears (and vice-versa).
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
    loop, // eslint-disable-line no-unused-vars -- consumed as clones via context
    children,
    style,
    ...rest
  } = props;
  const loopClones = useContext(WheelLoopClonesContext);
  const isLoop = Boolean(loopClones);

  // The id of the item currently sitting in the center row. Guards the
  // effects below so an external value change (or the initial mount) scrolls
  // the selection into place, while our own scroll-driven selection does not
  // scroll a second time.
  const centeredIdRef = useRef(null);
  // The id of the real input that currently holds the group's single Tab stop
  // (roving tabindex). Guards setRovingTabindex so it only rewrites tabindex
  // when the tabbable element actually changes.
  const rovingInputIdRef = useRef(null);

  const styleWithVars = {
    "--wheel-visible-count": visibleCount,
    ...(itemHeight === undefined
      ? {}
      : {
          "--wheel-item-height":
            typeof itemHeight === "number" ? `${itemHeight}px` : itemHeight,
        }),
    ...style,
  };

  const getViewport = () => ref.current?.querySelector(".navi_wheel_viewport");

  const centerItem = (viewportEl, itemEl, behavior) => {
    const base =
      itemEl.offsetTop - (viewportEl.clientHeight - itemEl.clientHeight) / 2;
    let top = base;
    // In loop mode the same value also lives in the clone buffers, so a real
    // item can be centered at base ± k·realHeight. Pick the copy nearest the
    // current scroll position so movement stays minimal and continuous — e.g.
    // arrowing down off the last value scrolls one step down onto the "first"
    // clone (which the wrap then normalises) instead of jumping to the top.
    if (isLoop && loopClones.length) {
      const realHeight = itemEl.offsetHeight * loopClones.length;
      if (realHeight > 0) {
        const copies = Math.round((viewportEl.scrollTop - base) / realHeight);
        top = base + copies * realHeight;
      }
    }
    viewportEl.scrollTo({ top, behavior });
  };

  // Loop layout: [before buffer][real items][after buffer], where each buffer
  // is only `visibleCount` proxy rows — the last N values above, the first N
  // below (just enough to fill the viewport at the edges). The real items own
  // the band [bufferHeight, bufferHeight + realHeight). Whenever the viewport
  // center drifts out of that band we instantly shift scrollTop by a whole
  // number of real-list heights to fold it back — invisible because a proxy
  // shows the exact same value the real row at center±realHeight would. This is
  // what makes the wheel spin endlessly. Runs on every scroll event so even a
  // long fling (spanning several list heights) is folded back with the modulo.
  const wrapScrollIntoRealCopy = (viewportEl) => {
    const realItem = viewportEl.querySelector("[navi-list-item-real]");
    if (!realItem || !loopClones.length) {
      return;
    }
    const itemHeightPx = realItem.offsetHeight;
    const realHeight = itemHeightPx * loopClones.length;
    if (realHeight === 0) {
      return;
    }
    const bufferHeight = itemHeightPx * visibleCount;
    const center = viewportEl.scrollTop + viewportEl.clientHeight / 2;
    if (center >= bufferHeight && center < bufferHeight + realHeight) {
      return;
    }
    const offsetInBand =
      (((center - bufferHeight) % realHeight) + realHeight) % realHeight;
    const wrappedCenter = bufferHeight + offsetInBand;
    viewportEl.scrollTop += wrappedCenter - center;
  };

  // A clone was clicked — select (and center) the real item at the same index.
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

  // Roving tabindex: only one item is in the Tab order at a time, so tabbing
  // into the wheel lands on the current value (like a native radio group) — not
  // the first or last item — and arrow keys move the Tab stop along with focus.
  const setRovingTabindex = (viewportEl, activeItemEl) => {
    const activeInput = activeItemEl?.querySelector(
      "[navi-selectable-real-input]",
    );
    if (!activeInput || activeInput.id === rovingInputIdRef.current) {
      return;
    }
    rovingInputIdRef.current = activeInput.id;
    const inputs = viewportEl.querySelectorAll("[navi-selectable-real-input]");
    for (const input of inputs) {
      input.tabIndex = input === activeInput ? 0 : -1;
    }
  };

  // Sync the center row with the current selection (checked radio) — used on
  // first display and whenever the controlled value changes from outside.
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

  // Initial centering — deferred until the wheel is actually on screen so
  // scrollTo isn't a no-op inside a closed popover/dialog.
  useDisplayedLayoutEffect(
    ref,
    (el) => {
      const viewportEl = el.querySelector(".navi_wheel_viewport");
      syncCenterToSelection(viewportEl, "auto");
      setRovingTabindex(viewportEl, getSelectedItem(viewportEl));
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
    setRovingTabindex(viewportEl, getSelectedItem(viewportEl));
  });

  // Scroll handling: keep the center marker up to date live, and select the
  // centered item once scrolling settles.
  useLayoutEffect(() => {
    const el = ref.current;
    const viewportEl = el.querySelector(".navi_wheel_viewport");
    let rafId = null;
    let settleTimer = null;

    const onScroll = () => {
      if (isLoop) {
        wrapScrollIntoRealCopy(viewportEl);
      }
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          const centered = findCenteredItem(viewportEl);
          updateCurrentMarker(viewportEl, centered);
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
  }, [isLoop]);

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
      setRovingTabindex(viewportEl, itemEl);
      centerItem(viewportEl, itemEl, "smooth");
    };
    el.addEventListener("focusin", onFocusIn);
    return () => {
      el.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  return (
    <Box
      {...rest}
      ref={ref}
      baseClassName="navi_wheel_container"
      pseudoClasses={WHEEL_PSEUDO_CLASSES}
      style={styleWithVars}
    >
      <div className="navi_wheel_viewport">
        <ul className="navi_wheel_list" data-loop={isLoop ? "" : undefined}>
          {isLoop
            ? renderClones(
                getLoopBufferItems(loopClones, visibleCount, "before"),
                "before",
                handleCloneClick,
              )
            : null}
          {children}
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
const WHEEL_PSEUDO_CLASSES = [":focus-within", ":read-only", ":disabled"];

// The `visibleCount` proxy rows to render on one side of the real items:
//   - "before" → the last N values (…, len-2, len-1) so that the row just above
//     the first real item shows the last value (wrap: … 44 45 | 00 …).
//   - "after"  → the first N values (0, 1, …) so the row just below the last
//     real item shows the first value (… 45 | 00 01 …).
// Each descriptor keeps the real value index so a clone click maps back to it.
const getLoopBufferItems = (clones, visibleCount, side) => {
  const count = clones.length;
  const items = [];
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

const findCenteredItem = (viewportEl) => {
  const items = viewportEl.querySelectorAll("[navi-list-item-real]");
  const center = viewportEl.scrollTop + viewportEl.clientHeight / 2;
  let closest = null;
  let closestDistance = Infinity;
  for (const item of items) {
    const itemCenter = item.offsetTop + item.offsetHeight / 2;
    const distance = Math.abs(itemCenter - center);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = item;
    }
  }
  return closest;
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
  props.selectable = props.selectable ?? true;

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
 * Wheel.Item — a selectable value in a Wheel.
 *
 * Reuses the selectable List item behaviour (hidden radio + click/keyboard
 * selection). The children are just the label shown in the row.
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
 * them (e.g. a "HH : MM : SS" time picker).
 *
 * Put <Wheel> and <WheelGroup.Separator> as direct children. Each wheel that
 * touches a separator eats half of it so its scroll surface (not the inert
 * separator) receives wheel/drag/scroll over the separator glyph — see the
 * .navi_wheel_group CSS note.
 *
 * @type {import("preact").FunctionComponent<{
 *   separatorWidth?: number | string,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {number|string} [props.separatorWidth] - Width of each separator column (number = px; default 1ch). Also sets how far a neighbouring wheel's scroll surface reaches under the separator.
 */
export const WheelGroup = ({
  separatorWidth,
  className,
  style,
  children,
  ...rest
}) => {
  import.meta.css = css;
  const groupStyle = {
    ...(separatorWidth === undefined
      ? {}
      : {
          "--wheel-separator-width":
            typeof separatorWidth === "number"
              ? `${separatorWidth}px`
              : separatorWidth,
        }),
    ...style,
  };
  return (
    <div
      {...rest}
      className={
        className ? `navi_wheel_group ${className}` : "navi_wheel_group"
      }
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
