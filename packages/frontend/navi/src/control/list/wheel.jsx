import { dispatchCustomEvent } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useId, useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
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
    --wheel-item-height: round(2.4em, 1px);
    --wheel-item-width: 3.5ch;
    --wheel-visible-count: 3;
    --wheel-color: light-dark(#111, #eee);
    --wheel-color-faded: light-dark(#bbb, #555);

    position: relative; /* for the loading outline */
    display: inline-flex;
    color: var(--wheel-color-faded);
    font-size: var(--navi-control-font-size);
    font-family: var(--navi-control-font-family);
    border-radius: var(--navi-control-border-radius);

    /* Keyboard interaction focus-visibles a hidden radio inside; show the focus
       outline on the whole column, not just the selected row. [data-focus-visible]
       lets a caller force the state (e.g. in a demo). */
    &:has([navi-selectable-real-input]:focus-visible),
    &[data-focus-visible] {
      outline-width: var(--navi-focus-outline-width);
      outline-style: solid;
      outline-color: var(--navi-focus-outline-color);
      outline-offset: calc(var(--navi-focus-outline-width) / 2);
    }

    /* Readonly & disabled look the same: only the *selected* value is dimmed,
       the neighbours stay as visible as normal. Disabled dims it a bit more
       (greyer AND semi-transparent). Scrolling is blocked in JS for both. */
    &[data-readonly] {
      --wheel-color: light-dark(#666, #999);
    }
    &[data-disabled] {
      --wheel-color: light-dark(rgba(0, 0, 0, 0.4), rgba(255, 255, 255, 0.45));

      /* Neutralise clicks on the hidden inputs (the selectable area re-enables
         them). The .navi_wheel_item raises specificity above that rule. Hover
         then lands on the viewport, so neighbours show the default cursor, not
         a pointer — and the viewport still receives wheel/touch so the JS block
         can preventDefault them. */
      .navi_wheel_item [navi-selectable-real-input] {
        pointer-events: none;
      }
    }
  }

  .navi_wheel_viewport {
    position: relative;
    touch-action: none;
    /* No native scroll: the list track is positioned by transform (see
       renderPos). Overflow clips the off-center rows; touch-action:none routes
       drags to our pointer handlers instead of the browser's scroll. */
    overflow: hidden;
  }
  .navi_wheel_list {
    /* Positioned via translate3d — hint the compositor. */
    will-change: transform;
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
    -webkit-tap-highlight-color: transparent;
    /* Rendering virtualization: only the rows within each wheel's own viewport
       are painted; the rest (clipped by the viewport's overflow) are skipped.
       The box is still laid out (fixed main-axis size below), so offsets, snap
       and the wrap math are unaffected — this cuts paint/compositing cost so a
       wheel with many values (or a page full of wheels) scrolls smoothly. */
    content-visibility: auto;

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

    /* Emphasis fades in/out only once the wheel is ready — never on first paint,
       so the initially-selected value is simply bold, not animated into bold. */
    .navi_wheel_container[data-ready] & {
      transition: color 0.15s ease;
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
      /* Main-axis size is fixed (height); reserve a remembered cross-axis size
         so a skipped row doesn't collapse the wheel's width. */
      contain-intrinsic-width: auto 3ch;
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
      /* Main-axis size is fixed (width); reserve a remembered cross-axis size. */
      contain-intrinsic-height: auto 1.5em;
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

  /* ── Glass ───────────────────────────────────────────────────────────────────
     Two frosted panes over the rows on each side of the center, leaving a clear
     "window" one row tall over the selection. Neighbours read as obscured (blur +
     a translucent veil) rather than merely greyed. Purely decorative — pointer
     events pass straight through to the rows underneath. With [data-glass-frame]
     the pane edge facing the center draws a faint line, framing the window. */
  .navi_wheel_pane {
    position: absolute;
    z-index: 1;
    background: light-dark(
      rgba(255, 255, 255, var(--wheel-glass-veil, 0.4)),
      rgba(0, 0, 0, var(--wheel-glass-veil, 0.4))
    );
    border: 0 solid
      var(
        --wheel-glass-frame-color,
        light-dark(rgba(0, 0, 0, 0.14), rgba(255, 255, 255, 0.18))
      );
    backdrop-filter: blur(var(--wheel-glass-blur, 1.5px));
    -webkit-backdrop-filter: blur(var(--wheel-glass-blur, 1.5px));
    pointer-events: none;
  }
  .navi_wheel_container:not([data-horizontal]) .navi_wheel_pane {
    right: 0;
    left: 0;
    height: calc((100% - var(--wheel-item-height)) / 2);

    &[data-side="start"] {
      top: 0;
    }
    &[data-side="end"] {
      bottom: 0;
    }
  }
  .navi_wheel_container[data-horizontal] .navi_wheel_pane {
    top: 0;
    bottom: 0;
    width: calc((100% - var(--wheel-item-width)) / 2);

    &[data-side="start"] {
      left: 0;
    }
    &[data-side="end"] {
      right: 0;
    }
  }
  .navi_wheel_container[data-glass-frame] {
    &:not([data-horizontal]) .navi_wheel_pane[data-side="start"] {
      border-bottom-width: 1px;
    }
    &:not([data-horizontal]) .navi_wheel_pane[data-side="end"] {
      border-top-width: 1px;
    }
    &[data-horizontal] .navi_wheel_pane[data-side="start"] {
      border-right-width: 1px;
    }
    &[data-horizontal] .navi_wheel_pane[data-side="end"] {
      border-left-width: 1px;
    }
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
    /* A sibling of the wheels, so it does NOT inherit their --wheel-item-height
       (that lives on .navi_wheel_container). Re-expose a default here so custom
       separator content can rely on it, e.g. line-height: var(--wheel-item-height)
       to make a single line exactly one row tall. */
    --wheel-item-height: round(2.4em, 1px);

    display: flex;
    /* Stretch to the group height (= the wheels' height) and center the content,
       which lands it on the middle (selected) row. */
    align-items: center;
    align-self: stretch;
    justify-content: center;
    color: var(--wheel-color, light-dark(#111, #eee));
    font-weight: 600;
    font-size: var(--navi-control-font-size);
    font-family: var(--navi-control-font-family);
    white-space: nowrap;
    user-select: none;

    /* <WheelGroup.Separator center> — snap a single text line onto the row. */
    &[data-center] {
      line-height: var(--wheel-item-height);
    }
  }
`;

// Upper bound on the loop runway rendered on each side. A fling never travels
// this many rows between scroll events, so more would only add invisible DOM.
const LOOP_BUFFER_MAX = 20;

// Fling physics (px per ms). Velocity is capped so a violent fling can't outrun
// the rendered runway and flash blank. Below the snap threshold the settle loop
// switches from momentum to a spring that eases into the nearest row center.
const WHEEL_MAX_VELOCITY = 2.2;
const WHEEL_SNAP_VELOCITY = 0.35;

// Keys that move focus between items (and thus trigger the browser's focus
// scroll-into-view we need to undo — see the focusin effect).
const NAV_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

// Wheel.Item registers its {value, label} here so WheelUI knows the full ordered
// list of items regardless of how children are wrapped (providers, fragments…).
// indexRef gives each item its position: WheelUI resets it to 0 every render and
// each item reads-and-increments it as it renders, in document order.
const WheelItemTrackerContext = createContext(null);

// Lets a WheelGroup push shared presentation (glass, orientation) down to every
// Wheel inside it without threading the prop through each one.
const WheelGroupContext = createContext(null);

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
 * @param {boolean} [props.glass] - Frost the neighbouring rows so the center reads as a clear "window" (iOS-picker style). Inherited from a WheelGroup.
 * @param {boolean} [props.glassFrame] - With glass, line the window edges with a faint frame (off by default). Tune via --wheel-glass-frame-color.
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
    glass,
    glassFrame,
    type,
    style,
    basePseudoState,
    children,
    ...rest
  } = props;
  const group = useContext(WheelGroupContext);
  const isHorizontal = Boolean(horizontal ?? group?.horizontal);
  const isLoop = Boolean(loop);
  // Glass: frost the neighbouring rows so the center reads as a clear "window"
  // (like the iOS picker). glassFrame additionally lines the window edges.
  // Both inherited from a WheelGroup so a whole group is styled with one prop.
  const showGlass = Boolean(glass ?? group?.glass);
  const showGlassFrame = Boolean(glassFrame ?? group?.glassFrame);
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
  // The wheel does NOT use native scroll. `posRef` is our own virtual scroll
  // position (px, main axis); the list track is translated by -pos. This is the
  // single source of truth, wrapped modulo the real-list extent in loop mode, so
  // there is no physical scroll edge to get stuck at. animRef holds the current
  // rAF (momentum/glide) so it can be cancelled.
  const posRef = useRef(0);
  const animRef = useRef(null);

  // How many clone rows to render on each side of the real items as scroll
  // runway. Because the sequence is periodic with period N, the wrap stays
  // seamless for any count, so we render enough looping values (never blank) to
  // outrun a fling — but no more, to keep the DOM light: at least a couple of
  // viewports, at most LOOP_BUFFER_MAX. It doesn't need a whole extra copy; the
  // runway is invisible (the wrap keeps the center on real items).
  const minBufferCount = visibleCount * 2;
  let loopBufferCount = loopClones.length;
  if (loopBufferCount < minBufferCount) {
    loopBufferCount = minBufferCount;
  } else if (loopBufferCount > LOOP_BUFFER_MAX) {
    loopBufferCount = LOOP_BUFFER_MAX;
  }

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
  const viewportMain = (vp) =>
    isHorizontal ? vp.clientWidth : vp.clientHeight;
  const itemMainStart = (el) => (isHorizontal ? el.offsetLeft : el.offsetTop);
  const itemMainSize = (el) =>
    isHorizontal ? el.offsetWidth : el.offsetHeight;

  const getViewport = () => ref.current?.querySelector(".navi_wheel_viewport");
  const getTrack = (vp) => vp.querySelector(".navi_wheel_list");

  const clampNumber = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  // Push the current virtual position onto the track via transform, and refresh
  // the "current" emphasis. No native scroll is involved.
  const renderPos = (vp) => {
    const track = getTrack(vp);
    if (track) {
      const p = -posRef.current;
      track.style.transform = isHorizontal
        ? `translate3d(${p}px, 0, 0)`
        : `translate3d(0, ${p}px, 0)`;
    }
    updateCurrentMarker(vp, findCenteredRow(vp));
  };

  const findCenteredMatching = (viewportEl, selector) => {
    const items = viewportEl.querySelectorAll(selector);
    const center = posRef.current + viewportMain(viewportEl) / 2;
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
  // Selection tracks the centered *real* item.
  const findCenteredItem = (viewportEl) =>
    findCenteredMatching(viewportEl, "[navi-list-item-real]");
  // The "current" emphasis tracks the centered *rendered row* including loop
  // proxies, so a proxy lights up exactly like a real value as it reaches the
  // center — the wrap that swaps it for the real row is then invisible.
  const findCenteredRow = (viewportEl) =>
    findCenteredMatching(viewportEl, ".navi_wheel_item");

  // The virtual position that centers a given row.
  const centerPosFor = (vp, el) =>
    itemMainStart(el) - (viewportMain(vp) - itemMainSize(el)) / 2;

  // Loop: fold the position back into the real-items band [bufferSpan,
  // bufferSpan+realSpan). A real-list extent away shows identical content, so
  // this is invisible — and because it's our own value (not scrollTop) there is
  // no physical edge to get stuck against. Returns true if it moved.
  const wrapPos = (vp) => {
    const realItem = vp.querySelector("[navi-list-item-real]");
    if (!realItem || !loopClones.length) {
      return false;
    }
    const realSpan = itemMainSize(realItem) * loopClones.length;
    if (realSpan === 0) {
      return false;
    }
    const bufferSpan = itemMainStart(realItem);
    const center = posRef.current + viewportMain(vp) / 2;
    if (center >= bufferSpan && center < bufferSpan + realSpan) {
      return false;
    }
    const offsetInBand =
      (((center - bufferSpan) % realSpan) + realSpan) % realSpan;
    posRef.current += bufferSpan + offsetInBand - center;
    return true;
  };

  // Non-loop: clamp so the first/last value can't be scrolled past center.
  const clampPos = (vp) => {
    const items = vp.querySelectorAll("[navi-list-item-real]");
    if (!items.length) {
      return;
    }
    posRef.current = clampNumber(
      posRef.current,
      centerPosFor(vp, items[0]),
      centerPosFor(vp, items[items.length - 1]),
    );
  };

  // Set the position from user input: normalise (wrap in loop, clamp otherwise),
  // then render.
  const setPos = (vp, pos) => {
    posRef.current = pos;
    if (isLoop) {
      wrapPos(vp);
    } else {
      clampPos(vp);
    }
    renderPos(vp);
  };

  const cancelAnim = () => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  };

  // After motion stops: fold any clone back onto its real row (invisible), then
  // select the centered value.
  const commitSelection = (vp) => {
    if (isLoop && wrapPos(vp)) {
      renderPos(vp);
    }
    if (!interactive) {
      return;
    }
    const centered = findCenteredItem(vp);
    if (!centered) {
      return;
    }
    centeredIdRef.current = centered.id;
    const input = centered.querySelector("[navi-selectable-real-input]");
    if (input && (input.checked || input.disabled)) {
      return;
    }
    dispatchCustomEvent(ref.current, "navi_request_select", {
      event: new CustomEvent("navi_wheel_settle"),
      id: centered.id,
    });
  };

  // Glide the position to a target (easeOut). The position is set *raw* during
  // the glide (no wrap) so it can travel onto a clone; onDone normalises + selects.
  const animateTo = (vp, target, onDone) => {
    cancelAnim();
    const start = posRef.current;
    const dist = target - start;
    if (Math.abs(dist) < 0.5) {
      posRef.current = target;
      renderPos(vp);
      onDone();
      return;
    }
    const duration = clampNumber(Math.abs(dist) * 1.1, 160, 420);
    const startTime = performance.now();
    const step = (now) => {
      const t = clampNumber((now - startTime) / duration, 0, 1);
      posRef.current = start + dist * (1 - Math.pow(1 - t, 3));
      renderPos(vp);
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
        onDone();
      }
    };
    animRef.current = requestAnimationFrame(step);
  };

  // Settle after user input (fling or idle): a single continuous motion that
  // decays the initial velocity, then — once slow — springs into the nearest row
  // center. Momentum and snap are the same loop, so it eases into place instead
  // of momentum-then-abrupt-jump. Velocity is capped so a huge fling can't shoot
  // past the rendered runway (which would flash blank until it settles).
  const settle = (vp, velocity) => {
    cancelAnim();
    let v = clampNumber(velocity, -WHEEL_MAX_VELOCITY, WHEEL_MAX_VELOCITY);
    let last = performance.now();
    let snapping = Math.abs(v) < WHEEL_SNAP_VELOCITY;
    const step = (now) => {
      const dt = clampNumber(now - last, 0, 32);
      last = now;
      if (!snapping) {
        v *= Math.pow(0.95, dt / 16);
        setPos(vp, posRef.current + v * dt);
        if (Math.abs(v) < WHEEL_SNAP_VELOCITY) {
          snapping = true;
        }
        animRef.current = requestAnimationFrame(step);
        return;
      }
      const row = findCenteredRow(vp);
      if (!row) {
        animRef.current = null;
        commitSelection(vp);
        return;
      }
      const dist = centerPosFor(vp, row) - posRef.current;
      if (Math.abs(dist) < 0.4) {
        setPos(vp, posRef.current + dist);
        animRef.current = null;
        commitSelection(vp);
        return;
      }
      setPos(vp, posRef.current + dist * 0.22);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  };

  // Center a specific item (external value / initial / keyboard). Smooth picks
  // the nearest copy so arrowing off an end glides one step onto a clone.
  const centerOn = (vp, itemEl, behavior) => {
    const base = centerPosFor(vp, itemEl);
    let target = base;
    if (isLoop && loopClones.length && behavior === "smooth") {
      const realSpan = itemMainSize(itemEl) * loopClones.length;
      if (realSpan > 0) {
        const copies = Math.round((posRef.current - base) / realSpan);
        target = base + copies * realSpan;
      }
    }
    if (behavior === "smooth") {
      animateTo(vp, target, () => commitSelection(vp));
    } else {
      setPos(vp, target);
    }
  };

  // A proxy was clicked — select (and glide to) the real item it stands in for.
  const handleCloneClick = (index) => {
    const vp = getViewport();
    if (!vp) {
      return;
    }
    const target = vp.querySelectorAll("[navi-list-item-real]")[index];
    if (!target) {
      return;
    }
    centeredIdRef.current = target.id;
    const input = target.querySelector("[navi-selectable-real-input]");
    if (!input || !input.checked) {
      dispatchCustomEvent(ref.current, "navi_request_select", {
        event: new CustomEvent("navi_wheel_clone_click"),
        id: target.id,
      });
    }
    centerOn(vp, target, "smooth");
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
    centerOn(viewportEl, selectedItem, behavior);
  };

  // Initial centering — deferred until the wheel is on screen (offsets need real
  // layout, e.g. not inside a closed popover/dialog).
  useDisplayedLayoutEffect(
    ref,
    (el) => {
      const vp = el.querySelector(".navi_wheel_viewport");
      syncCenterToSelection(vp, "auto");
      // Re-mark once more after a frame: the first pass can run before the flex
      // rows get their final offsets, which would land the "current" emphasis on
      // the wrong row — the selected value would show unhighlighted (grey like
      // its neighbours) until the first interaction. Recompute from stable
      // layout so it's bold from the start.
      const rafId = requestAnimationFrame(() => {
        centeredIdRef.current = null;
        syncCenterToSelection(vp, "auto");
        // Enable emphasis/state transitions only once the initial value is in
        // place, so nothing animates just because the wheel appeared.
        el.setAttribute("data-ready", "");
      });
      return () => {
        cancelAnimationFrame(rafId);
      };
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

  // Input: wheel + pointer drag drive the virtual position; a short idle after
  // wheel, or the end of a drag's momentum, snaps to the nearest value. Readonly
  // pops the callout instead of moving; disabled is inert (no events reach here).
  useLayoutEffect(() => {
    const el = ref.current;
    const vp = el.querySelector(".navi_wheel_viewport");
    let settleTimer = null;
    let calloutCooldown = null;

    const scheduleSettle = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => settle(vp, 0), 90);
    };
    const readonlyCallout = (event) => {
      if (!readOnly || calloutCooldown !== null) {
        return;
      }
      calloutCooldown = setTimeout(() => {
        calloutCooldown = null;
      }, 600);
      const current = getSelectedItem(vp) || findCenteredItem(vp);
      if (current) {
        // Rejected by the selectable layer (readonly) → pops the callout.
        dispatchCustomEvent(el, "navi_request_select", {
          event,
          id: current.id,
        });
      }
    };
    // Non-loop only: is a wheel in this direction blocked (so the page should
    // scroll instead of the wheel trapping it)?
    const atClampedEnd = (delta) => {
      if (isLoop) {
        return false;
      }
      const items = vp.querySelectorAll("[navi-list-item-real]");
      if (!items.length) {
        return false;
      }
      const min = centerPosFor(vp, items[0]);
      const max = centerPosFor(vp, items[items.length - 1]);
      return (
        (delta < 0 && posRef.current <= min + 0.5) ||
        (delta > 0 && posRef.current >= max - 0.5)
      );
    };

    const onWheel = (e) => {
      const delta = isHorizontal ? e.deltaX || e.deltaY : e.deltaY;
      if (!delta) {
        return;
      }
      if (!interactive) {
        e.preventDefault();
        readonlyCallout(e);
        return;
      }
      if (atClampedEnd(delta)) {
        return; // let the page scroll past a non-looping end
      }
      e.preventDefault();
      cancelAnim();
      setPos(vp, posRef.current + delta);
      scheduleSettle();
    };

    let drag = null;
    const onPointerDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) {
        return;
      }
      if (!interactive) {
        readonlyCallout(e);
        return;
      }
      cancelAnim();
      const client = isHorizontal ? e.clientX : e.clientY;
      drag = {
        pointerId: e.pointerId,
        startClient: client,
        startPos: posRef.current,
        lastClient: client,
        lastTime: performance.now(),
        velocity: 0,
        moved: false,
        captured: false,
      };
    };
    const onPointerMove = (e) => {
      if (!drag || e.pointerId !== drag.pointerId) {
        return;
      }
      const client = isHorizontal ? e.clientX : e.clientY;
      const total = client - drag.startClient;
      if (!drag.moved && Math.abs(total) > 3) {
        drag.moved = true;
        drag.captured = true;
        vp.setPointerCapture(e.pointerId);
      }
      if (!drag.moved) {
        return;
      }
      const now = performance.now();
      const dt = now - drag.lastTime;
      if (dt > 0) {
        drag.velocity = (client - drag.lastClient) / dt;
      }
      drag.lastClient = client;
      drag.lastTime = now;
      // Finger down → content down → position decreases.
      setPos(vp, drag.startPos - total);
    };
    const onPointerUp = (e) => {
      if (!drag || e.pointerId !== drag.pointerId) {
        return;
      }
      const wasDrag = drag.moved;
      const velocity = drag.velocity;
      if (drag.captured) {
        vp.releasePointerCapture(e.pointerId);
      }
      drag = null;
      if (!wasDrag) {
        return; // a tap → let the underlying radio handle selection
      }
      // Position moves opposite to the finger.
      settle(vp, -velocity);
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    vp.addEventListener("pointerdown", onPointerDown);
    vp.addEventListener("pointermove", onPointerMove);
    vp.addEventListener("pointerup", onPointerUp);
    vp.addEventListener("pointercancel", onPointerUp);
    return () => {
      clearTimeout(settleTimer);
      clearTimeout(calloutCooldown);
      cancelAnim();
      vp.removeEventListener("wheel", onWheel);
      vp.removeEventListener("pointerdown", onPointerDown);
      vp.removeEventListener("pointermove", onPointerMove);
      vp.removeEventListener("pointerup", onPointerUp);
      vp.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isLoop, isHorizontal, interactive, readOnly]);

  // Keyboard: the focus group moves focus between the hidden radios; we glide
  // the focused value to center. Overflow is hidden, so the browser can't
  // scroll-into-view and fight us. Arrows are swallowed when not interactive.
  useLayoutEffect(() => {
    const el = ref.current;
    const vp = el.querySelector(".navi_wheel_viewport");
    const onKeyDownCapture = (e) => {
      if (!NAV_KEYS.has(e.key) || interactive) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const onFocusIn = (e) => {
      if (!interactive) {
        return;
      }
      const input = e.target.closest("[navi-selectable-real-input]");
      if (!input) {
        return;
      }
      const itemEl = input.closest("[navi-list-item-real]");
      if (!itemEl) {
        return;
      }
      centeredIdRef.current = itemEl.id;
      updateCurrentMarker(vp, itemEl);
      centerOn(vp, itemEl, "smooth");
    };
    el.addEventListener("keydown", onKeyDownCapture, true);
    el.addEventListener("focusin", onFocusIn);
    return () => {
      el.removeEventListener("keydown", onKeyDownCapture, true);
      el.removeEventListener("focusin", onFocusIn);
    };
  }, [isHorizontal, interactive]);

  return (
    <Box
      {...rest}
      ref={ref}
      baseClassName="navi_wheel_container"
      data-horizontal={isHorizontal ? "" : undefined}
      data-glass={showGlass ? "" : undefined}
      data-glass-frame={showGlass && showGlassFrame ? "" : undefined}
      data-wheel-type={type || undefined}
      // Disabled = fully inert: no focus, no keyboard (arrows), no pointer.
      // Programmatic centering still works (inert only blocks user interaction).
      inert={disabled ? true : undefined}
      pseudoClasses={WHEEL_PSEUDO_CLASSES}
      basePseudoState={basePseudoState}
      style={styleWithVars}
    >
      <LoadingOutline loading={loading} inset={-1} />
      <div className="navi_wheel_viewport">
        <ul className="navi_wheel_list" data-loop={isLoop ? "" : undefined}>
          {isLoop
            ? renderClones(
                getLoopBufferItems(loopClones, loopBufferCount, "before"),
                "before",
                handleCloneClick,
              )
            : null}
          <WheelItemTrackerContext.Provider value={trackerContextRef.current}>
            {children}
          </WheelItemTrackerContext.Provider>
          {isLoop
            ? renderClones(
                getLoopBufferItems(loopClones, loopBufferCount, "after"),
                "after",
                handleCloneClick,
              )
            : null}
        </ul>
        {showGlass ? (
          <>
            <div className="navi_wheel_pane" data-side="start" />
            <div className="navi_wheel_pane" data-side="end" />
          </>
        ) : null}
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
  // A wheel is readonly/disabled as a whole, not per-option — so a blocked
  // interaction should say "this control is read-only", not the list's
  // per-option "this option isn't available".
  props.readOnlyMessage =
    props.readOnlyMessage ?? naviI18n("constraint.readonly.default", props);

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
 * @param {boolean} [props.glass] - Frost every wheel's neighbouring rows (see Wheel's glass prop) with one prop for the whole group.
 * @param {boolean} [props.glassFrame] - With glass, line every wheel's window edges with a faint frame (off by default).
 */
export const WheelGroup = ({
  spacing,
  horizontal,
  glass,
  glassFrame,
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
  // A Box (not a plain div) so style props like border/padding work directly.
  return (
    <Box
      {...rest}
      baseClassName="navi_wheel_group"
      data-horizontal={horizontal ? "" : undefined}
      style={groupStyle}
    >
      <WheelGroupContext.Provider value={{ glass, glassFrame, horizontal }}>
        {children}
      </WheelGroupContext.Provider>
    </Box>
  );
};
/**
 * WheelGroup.Separator — content shown between wheels (":", a word, an icon…).
 *
 * @param {object} props
 * @param {boolean} [props.center] - Snap a single line of text onto the center
 *   row by matching the item height (line-height: var(--wheel-item-height)).
 *   Content is already flex-centered by default; use this to fine-tune glyphs
 *   like ":" without reaching for the CSS variable yourself.
 */
const WheelGroupSeparator = ({ children, center, ...rest }) => {
  return (
    <Box
      as="span"
      {...rest}
      className="navi_wheel_group_separator"
      data-center={center ? "" : undefined}
      aria-hidden="true"
    >
      {children}
    </Box>
  );
};
WheelGroup.Separator = WheelGroupSeparator;
