import { dispatchCustomEvent } from "@jsenv/dom";
import { useId, useLayoutEffect, useRef } from "preact/hooks";

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
  }

  .navi_wheel_item {
    position: relative;
    display: flex;
    height: var(--wheel-item-height);
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
    }

    &[data-disabled] {
      opacity: 0.4;
      cursor: default;
    }
  }

  .navi_wheel_item_decoration {
    --wheel-item-height: 2.4em;

    display: flex;
    height: var(--wheel-item-height);
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: var(--navi-control-font-size);
    font-family: var(--navi-control-font-family);
  }
`;

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
 */
export const Wheel = createComponentResolver([
  WheelFirstResolver,
  ListSelectableResolver,
  WheelUI,
]);

function WheelUI(props) {
  import.meta.css = css;
  const { ref, visibleCount = 3, itemHeight, children, style, ...rest } = props;

  // The id of the item currently sitting in the center row. Guards the
  // effects below so an external value change (or the initial mount) scrolls
  // the selection into place, while our own scroll-driven selection does not
  // scroll a second time.
  const centeredIdRef = useRef(null);

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
    const top =
      itemEl.offsetTop - (viewportEl.clientHeight - itemEl.clientHeight) / 2;
    viewportEl.scrollTo({ top, behavior });
  };

  // Sync the center row with the current selection (checked radio) — used on
  // first display and whenever the controlled value changes from outside.
  const syncCenterToSelection = (viewportEl, behavior) => {
    const checkedInput = viewportEl.querySelector(
      "[navi-selectable-real-input]:checked",
    );
    const selectedItem = checkedInput
      ? checkedInput.closest("[navi-list-item-real]")
      : viewportEl.querySelector("[navi-list-item-real]");
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

  // Scroll handling: keep the center marker up to date live, and select the
  // centered item once scrolling settles.
  useLayoutEffect(() => {
    const el = ref.current;
    const viewportEl = el.querySelector(".navi_wheel_viewport");
    let rafId = null;
    let settleTimer = null;

    const onScroll = () => {
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
  }, []);

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
        <ul className="navi_wheel_list">{children}</ul>
      </div>
    </Box>
  );
}
const WHEEL_PSEUDO_CLASSES = [":focus-within", ":read-only", ":disabled"];

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
