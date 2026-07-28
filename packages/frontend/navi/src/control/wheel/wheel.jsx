/*
 * Wheel — a single-value control rendered as an iOS-style scroll picker. A short
 * viewport shows the selected value in the middle with the neighbouring values
 * faded above/below (or left/right when `horizontal`). The selected value is
 * whichever item is closest to the center; the user changes it by scrolling,
 * dragging, clicking a neighbour, or with the arrow keys.
 *
 * A SPINBUTTON, NOT A RADIO GROUP. The whole wheel is one focusable element
 * (role=spinbutton, the container) whose value lives in an invisible input for
 * the form. Wheel.Item children only register their {value, label, itemProps}
 * with the wheel and render nothing; they carry no focusable input. The main-axis
 * arrows step the value by one row (a focus-free value change — no DOM focus moves
 * between rows, which is what makes keyboard nav cheap); the value updates
 * immediately while the selection glides to center.
 *
 * VIRTUALIZED. The DOM is NOT the source of truth — the ordered tracked-item list
 * is. Only visibleCount + 2 <li> slots are rendered (WheelWindow) and recycled: as
 * the wheel scrolls, each slot's content is refilled from trackedItems. The slots
 * re-render on demand — only when the wheel crosses a row (the window base index
 * changes) — never per frame; the per-frame motion is a single imperative
 * transform on the track (--wheel-offset, see applyOffset). All geometry is
 * computed from the value index and a measured uniform row size, not read off the
 * DOM.
 *
 * FRAMEWORK REUSE. value/defaultValue, action/uiAction, validation, states and
 * the readonly/disabled/busy callouts all come from the single-value control
 * facade (useControlFacadeProps → hidden input + facade container; see
 * picker.jsx). Wheel adds the scroll-picker rendering and these scroll behaviours:
 *   - scroll settles        → select the centered item
 *   - arrow key             → step + glide the new value to center
 *   - external value change  → scroll the selected item to center
 *
 * LOOP. A wheel wraps endlessly by default (`bounded` opts out, giving fixed
 * ends). Looping needs no extra rows: the window's slots wrap their value index
 * modulo the item count (wrapIndex), so the row after the last value shows the
 * first, seamlessly, in both directions. The position (pos) is folded back to the
 * canonical index * itemSize only when the wheel comes to rest (commitSelection),
 * never mid-glide — the transform stays bounded regardless because it is written
 * relative to the base the window currently shows (renderedBaseRef).
 *
 * ORIENTATION. Everything above is axis-agnostic: helpers read the main axis via
 * accessors (top/height vs left/width) chosen from `horizontal`, and the CSS has
 * a [data-horizontal] variant.
 */

import { useSignal } from "@preact/signals";
import { createContext } from "preact";
import { useContext, useId, useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { compareTwoJsValues } from "@jsenv/navi/src/utils/compare_two_js_values.js";
import {
  ControlFacadeChildrenWrapper,
  ControlgroupChildrenWrapper,
  useControlFacadeProps,
  useControlgroupProps,
} from "../control_hooks.jsx";
import { getUIStateControllerById } from "../controller_registry.js";
import { dispatchRequestInteraction } from "../rules/control_interaction.js";
import { dispatchRequestSetUIState } from "../ui_state_dom.js";
import { useItemTracker } from "../../utils/item_tracker/use_item_tracker.js";
import { useDisplayedLayoutEffect } from "../../utils/use_displayed_layout_effect.js";

const css = /* css */ `
  .navi_wheel_container {
    --wheel-item-height: round(2.4em, 1px);
    --wheel-item-width: 3.5ch;
    --wheel-visible-count: 3;
    --wheel-color: light-dark(#111, #eee);

    position: relative; /* for the loading outline */
    display: inline-flex;
    color: var(--wheel-color);
    font-size: var(--navi-control-font-size);
    font-family: var(--navi-control-font-family);
    border-radius: var(--navi-control-border-radius);
    -webkit-tap-highlight-color: var(--navi-control-tap-highlight-color);

    /* Keyboard focus rings the center window only (see .navi_wheel_focus_ring) —
       the neighbours are just hints, so the ring belongs on the selected value,
       not the whole column. The spinbutton container is the focusable element, so
       suppress its own UA outline in favour of the ring. [data-focus-visible] lets
       a caller force the ring. */
    &:focus {
      outline: none;
    }
    &:focus-visible .navi_wheel_focus_ring,
    &[data-focus-visible] .navi_wheel_focus_ring {
      outline: var(--navi-focus-outline-width) solid
        var(--navi-focus-outline-color);
      /* Inset so overflow: hidden on the viewport doesn't clip the ring. */
      outline-offset: calc(-1 * var(--navi-focus-outline-width) / 2);
    }

    /* Readonly & disabled dim the neighbour text identically; disabled dims the
       centered value further so the state reads on the value itself. */
    &[data-readonly] {
      --wheel-color: light-dark(#666, #999);
    }
    &[data-disabled] {
      --wheel-color: light-dark(#666, #999);

      .navi_wheel_item[data-wheel-current] {
        color: light-dark(rgba(0, 0, 0, 0.32), rgba(255, 255, 255, 0.38));
      }
    }
    &[data-readonly],
    &[data-disabled] {
      /* Rows can't take a click, so the wheel-level readonly callout is the only
         one — no per-row callouts fire. */
      .navi_wheel_item {
        pointer-events: none;
      }
    }
  }

  /* Holds the value for the form. Invisible and inert: it keeps a box (for the
     callout to anchor to) but never takes focus, pointer, or paint. */
  .navi_wheel_input {
    position: absolute;
    inset: 0;
    width: auto;
    height: auto;
    opacity: 0;
    appearance: none;
    pointer-events: none;
  }

  .navi_wheel_viewport {
    position: relative;
    /* Default before the first pointer move; updateCursor refines it to plain in
       the center window. The rows inherit this. */
    cursor: pointer;
    touch-action: none;
    /* No native scroll: the list track is positioned by transform (see
       renderPos). Overflow clips the off-center rows; touch-action:none routes
       drags to our pointer handlers instead of the browser's scroll. */
    overflow: hidden;
  }
  .navi_wheel_list {
    display: flex;
    margin: 0;
    padding: 0;
    list-style: none;
    /* Virtual scroll position: JS writes --wheel-offset (px, already rounded to a
       whole pixel) each frame and CSS decides how to apply it. translate3d keeps
       the track on its own composited layer for smooth momentum/glide. */
    transform: translate3d(0, var(--wheel-offset, 0px), 0);
    /* NO will-change: transform. translate3d already composites the track;
       will-change additionally pins it to its own layer, which the glass panes'
       backdrop-filter then samples with a bright fringe (halo) around each glyph. */
  }

  /* type is informative metadata; a couple of types get a rendering hint.
     "integer" wants figures to line up column-to-column across rows. */
  .navi_wheel_container[data-wheel-type="integer"] {
    font-variant-numeric: tabular-nums;
  }

  .navi_wheel_item {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    /* Every row is identical: same colour, same weight. What makes the center
       stand out is the veil over the neighbours (see "Center window"), not any
       per-row style — so a row emphasises smoothly as it scrolls into place. */
    color: var(--wheel-color);
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    /* Cursor is set on the viewport by pointer position (see updateCursor) and
       inherited here, so it stays fixed to the center window rather than flipping
       as rows scroll under the pointer. */
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    /* Rendering virtualization: only the rows within each wheel's own viewport
       are painted; the rest (clipped by the viewport's overflow) are skipped.
       The box is still laid out (fixed main-axis size below), so offsets, snap
       and the wrap math are unaffected — this cuts paint/compositing cost so a
       wheel with many values (or a page full of wheels) scrolls smoothly. */
    content-visibility: auto;
  }

  /* Orientation-specific sizing/layout. The emphasis fade: opacity peaks on the
     center row and falls off progressively toward the edges (like a physical
     wheel curving away). Because it is a function of position, a row emphasises
     smoothly as it scrolls into the middle — no per-row style flip — and a
     half-scrolled row is half-faded. The center number keeps a small fully-opaque
     plateau so it stays crisp. */
  .navi_wheel_container {
    --wheel-fade: linear-gradient(
      var(--wheel-fade-direction),
      transparent 0%,
      rgba(0, 0, 0, 0.4) 34%,
      #000 45%,
      #000 55%,
      rgba(0, 0, 0, 0.4) 66%,
      transparent 100%
    );

    /* Two invisible panes cover the rows on each side of the center window, used
       only for optional effects (the fade already dims): [data-glass] frosts
       (blurs) them; [data-frame-border] lines the edge facing the window. The
       .navi_wheel_focus_ring outlines the window itself. Pane geometry, the ring
       geometry, and the frame edges are all orientation-specific, so they live in
       the branches below and reuse them. */
    .navi_wheel_pane {
      position: absolute;
      z-index: 1;
      border: 0 solid
        var(
          --wheel-frame-color,
          light-dark(rgba(0, 0, 0, 0.14), rgba(255, 255, 255, 0.18))
        );
      pointer-events: none;
    }
    .navi_wheel_focus_ring {
      position: absolute;
      z-index: 2;
      border-radius: 3px;
      pointer-events: none;
    }
    /* The loading outline (rendered as a container child, outside the viewport)
       tracks the center window like the focus ring, above the glass/fade so it
       is never dimmed. Geometry lives in the orientation branches. */
    .navi_wheel_outline_wrapper {
      position: absolute;
      z-index: 3;
      border-radius: inherit;
      pointer-events: none;
    }

    &[data-glass] .navi_wheel_pane {
      /* A faint frost tint under the blur flattens the halo a bare
         backdrop-filter leaves around dark glyphs; saturate revives the colours
         the blur washes out, for a truer glass look. Tune via --wheel-glass-*. */
      background: light-dark(
        rgba(255, 255, 255, var(--wheel-glass-tint, 0.3)),
        rgba(0, 0, 0, var(--wheel-glass-tint, 0.3))
      );
      backdrop-filter: blur(var(--wheel-glass-blur, 1.5px))
        saturate(var(--wheel-glass-saturate, 160%));
      -webkit-backdrop-filter: blur(var(--wheel-glass-blur, 1.5px))
        saturate(var(--wheel-glass-saturate, 160%));
    }

    &:not([data-horizontal]) {
      --wheel-fade-direction: to bottom;
      width: fit-content;

      .navi_wheel_viewport {
        width: 100%;
        height: calc(var(--wheel-item-height) * var(--wheel-visible-count));
        -webkit-mask-image: var(--wheel-fade);
        mask-image: var(--wheel-fade);
      }
      .navi_wheel_list {
        flex-direction: column;
      }
      .navi_wheel_item {
        /* Fixed main-axis size (height); the cross axis follows the content.
           box-sizing so per-item padding (below) doesn't grow the fixed row. */
        box-sizing: border-box;
        height: var(--wheel-item-height);
        padding-block: var(--navi-wheel-item-padding-main-default, 0px);
        /* No breathing room by default — the wheel shows its true content size.
           Spacing is the caller's choice, set PER ITEM (each Wheel.Item is a Box:
           paddingX here, since horizontal is the cross axis of a vertical wheel) so
           the padded area stays scrollable. Global defaults are the axis-named CSS
           vars — cross = perpendicular to scroll (the gap), main = along scroll. */
        padding-inline: var(--navi-wheel-item-padding-cross-default, 0px);
        /* A full-row line-height so the glyph's line box fills the (even) row
           height and centers on a WHOLE pixel. A "normal" line box is ~15px (odd):
           centered in a 32px row it lands on a .5 sub-pixel, and .5 rounds one way
           for this transformed track and the other for the static separators — a
           1px vertical misalignment. Matching var(--wheel-item-height) here and on
           the separators removes the .5. Vertical only: a horizontal wheel has no
           row height to fill, and forcing it would blow up the separator height. */
        line-height: var(--wheel-item-height);
      }
      .navi_wheel_pane {
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
      .navi_wheel_focus_ring,
      .navi_wheel_outline_wrapper {
        top: calc((100% - var(--wheel-item-height)) / 2);
        right: 0;
        bottom: calc((100% - var(--wheel-item-height)) / 2);
        left: 0;
        height: auto;
      }
      &[data-frame-border] .navi_wheel_pane {
        &[data-side="start"] {
          border-bottom-width: 1px;
        }
        &[data-side="end"] {
          border-top-width: 1px;
        }
      }
    }

    &[data-horizontal] {
      --wheel-fade-direction: to right;
      height: fit-content;

      .navi_wheel_viewport {
        width: calc(var(--wheel-item-width) * var(--wheel-visible-count));
        height: 100%;
        -webkit-mask-image: var(--wheel-fade);
        mask-image: var(--wheel-fade);
      }
      .navi_wheel_list {
        flex-direction: row;
        /* Horizontal wheels scroll along X (see --wheel-offset on the base rule). */
        transform: translate3d(var(--wheel-offset, 0px), 0, 0);
      }
      .navi_wheel_item {
        /* Fixed main-axis size (width); the cross axis (vertical here) follows the
           content. Same axis-named global defaults as the vertical branch, mapped
           to this orientation: cross = block (vertical), main = inline. 0 by
           default; opt in per item (paddingY here — see the vertical note). */
        box-sizing: border-box;
        width: var(--wheel-item-width);
        padding-block: var(--navi-wheel-item-padding-cross-default, 0px);
        padding-inline: var(--navi-wheel-item-padding-main-default, 0px);
      }
      .navi_wheel_pane {
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
      .navi_wheel_focus_ring,
      .navi_wheel_outline_wrapper {
        top: 0;
        right: calc((100% - var(--wheel-item-width)) / 2);
        bottom: 0;
        left: calc((100% - var(--wheel-item-width)) / 2);
        width: auto;
      }
      &[data-frame-border] .navi_wheel_pane {
        &[data-side="start"] {
          border-right-width: 1px;
        }
        &[data-side="end"] {
          border-left-width: 1px;
        }
      }
    }
  }

  /* ── WheelGroup ─────────────────────────────────────────────────────────────
     Several wheels with separators (e.g. ":") between them. The separator column
     keeps its natural content width (small for ":", wide for a word like "hours")
     and is not scrollable. Spacing around a wheel is that wheel's own item padding
     (set per Wheel.Item, see .navi_wheel_item) so it stays scrollable — a group
     with no padding shows the wheels at their true content width. */
  .navi_wheel_group {
    display: inline-flex;
    align-items: center;

    &:not([data-horizontal]) {
      /* Same full-row line-height as .navi_wheel_item so the glyph centers on a
         whole pixel and lands on the numbers' line (see the note there). Without
         it the separator sits ~1px off the transformed numbers. Vertical only: on
         a horizontal group it has no row height to fill and would over-tall the
         separator. */
      .navi_wheel_group_separator {
        line-height: var(--wheel-item-height);
      }
    }
    &[data-horizontal] {
      flex-direction: column;
      align-items: center;
    }
  }
  .navi_wheel_group_separator {
    /* Stretch to the group height (= the wheels' height) and center the content,
       landing it on the middle (selected) row and sharing the numbers' baseline
       (right for words / letters like "ZZ"). A sibling of the wheels, so it does
       NOT inherit their --wheel-item-height — re-expose it here. */
    --wheel-item-height: round(2.4em, 1px);

    display: flex;
    align-items: center;
    align-self: stretch;
    justify-content: center;
    color: var(--wheel-color, light-dark(#111, #eee));
    font-weight: 600;
    font-size: var(--navi-control-font-size);
    font-family: var(--navi-control-font-family);
    white-space: nowrap;

    user-select: none;
  }
  /* SVG ":" (Wheel.Colon). Height ≈ the digits' cap height so the two dots
     span a similar range; centered in the row (flex) → dots on the numbers'
     optical center. Width follows the viewBox aspect. */
  .navi_wheel_colon {
    display: block;
    width: auto;
    height: round(1em, 1px);
  }
`;

// Fling physics (px per ms). Velocity is capped so even a violent fling travels
// only a handful of rows (a picker isn't a free-scrolling list — overshooting
// dozens of values feels wrong). Each frame the velocity is multiplied by
// WHEEL_DECAY^(dt/16); lower stops sooner. Below the snap threshold the settle
// loop switches from momentum to a spring that eases into the nearest row
// center; the spring factor is how far toward that center it moves per frame.
const WHEEL_MAX_VELOCITY = 1;
const WHEEL_DECAY = 0.88;
const WHEEL_SNAP_VELOCITY = 0.3;
const WHEEL_SPRING_FACTOR = 0.2;

// Mouse-wheel settle. Rather than waiting out a long idle and then springing to
// whichever row is nearest (which snaps BACKWARD when you overshot, and reads as a
// late correction), we snap almost immediately to the row the scroll was HEADING
// for — the current position biased by the last scroll velocity. WHEEL_SETTLE_DELAY
// is just long enough to tell one gesture from the next; WHEEL_MOMENTUM_MS is how
// far (in ms of travel) the velocity projects, so a faster flick lands a row ahead.
const WHEEL_SETTLE_DELAY = 50; // ms of idle that ends the wheel gesture
const WHEEL_MOMENTUM_MS = 55; // velocity projection horizon (px = velocity × this)
// A mouse-wheel gesture is a burst of wheel events spaced only a few ms apart.
// Once this wheel has claimed a gesture, keep swallowing that gesture's remaining
// events even if the pointer drifts off onto the page — otherwise the document
// scrolls under the leftover events, which feels broken. This is the max gap (ms)
// between events still counted as the same gesture; kept short so that once the
// browser stops sending events (gesture over) the page is free again almost
// immediately — a fresh gesture on the page scrolls normally.
const WHEEL_GESTURE_MAX_GAP = 50;

// Default glide speed (px/ms). Feeds the spring stiffness that chases the target
// on arrow keys / clicks (see glideSpringFactor); the demo can override it.
const WHEEL_GLIDE_SPEED = 0.16; // ≈ one row (32px) in ~200ms at rest

// aria-valuemin / aria-valuemax bounds when every item value is a number, else
// null. Assistive tech reads it as the spinbutton's range. No Math.min/Math.max:
// a plain scan is easier to follow.
const getNumericRange = (items) => {
  if (items.length === 0) {
    return null;
  }
  let min = items[0].value;
  let max = items[0].value;
  for (const item of items) {
    const { value } = item;
    if (typeof value !== "number") {
      return null;
    }
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }
  return { min, max };
};

// Wheel.Item registers its {value, label} here so WheelUI knows the full ordered
// list of items regardless of how children are wrapped (providers, fragments…).
// indexRef gives each item its position: WheelUI resets it to 0 every render and
// each item reads-and-increments it as it renders, in document order.
const WheelItemTrackerContext = createContext(null);

// Lets a WheelGroup push shared presentation (glass, orientation) down to every
// Wheel inside it without threading the prop through each one.
const WheelGroupContext = createContext(null);

/**
 * Wheel — a scroll picker (see the file header). It is a single value control
 * (role=spinbutton), NOT a radio list: one focusable element, arrows change the
 * value, the value lives in one hidden input for the form. The visible rows are
 * presentational.
 *
 * @type {import("preact").FunctionComponent<{
 *   value?: any,
 *   defaultValue?: any,
 *   action?: (value: any) => void,
 *   uiAction?: (value: any) => void,
 *   visibleCount?: number,
 *   itemHeight?: number | string,
 *   itemWidth?: number | string,
 *   bounded?: boolean,
 *   horizontal?: boolean,
 *   glideSpeed?: number,
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
 * @param {number|string} [props.size] - Font size of the wheel: a size token ("s", "m", "l", "xl", …), a number (px), or a CSS length. Scales the digits and, since the row size is em-based, the row height too — a simple way to make the whole wheel bigger. An explicit itemHeight/itemWidth still overrides the row size.
 * @param {boolean} [props.bounded] - Give the wheel fixed ends instead of wrapping: it stops at the first/last value. By default the wheel loops endlessly (past the last value the first reappears, and vice-versa).
 * @param {boolean} [props.horizontal] - Lay the wheel out horizontally (scrolls left/right) instead of vertically.
 * @param {boolean} [props.glass] - Frost the neighbouring rows so the center reads as a clear "window" (iOS-picker style). Inherited from a WheelGroup.
 * @param {boolean} [props.frameBorder] - Line the center-window edges with a faint frame (off by default; independent of glass). Tune via --wheel-frame-color.
 * @param {number} [props.glideSpeed=0.16] - Speed (px/ms) of the programmatic glide used by arrow keys, taps and the navi_scroll "smooth" behavior. Lower = slower, more visible transitions; ≈0.16 covers one 32px row in 200ms.
 * @param {string} [props.type] - Informative value kind (e.g. "integer", "day"). Used only for rendering hints, like tabular figures for "integer".
 */
export const Wheel = (props) => {
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;

  return <WheelUI {...props} />;
};

// Wheel-only props: consumed here, must not leak onto the container DOM element.
const WHEEL_OWN_PROP_KEYS = [
  "visibleCount",
  "itemHeight",
  "itemWidth",
  "size",
  "bounded",
  "horizontal",
  "glass",
  "frameBorder",
  "glideSpeed",
  "type",
];

// Pointer drag, mouse-wheel, programmatic `navi_scroll`, and the document-level
// gesture guard: all the ways raw input drives the virtual position. Bound once
// to the viewport/container (re-bound only when orientation/loop/interactive
// change). A pure consumer of the animation core (setPos/settle/glideTo/… and the
// interaction gate) — it produces nothing the rest of the wheel needs back.
//
// Input: wheel + pointer drag drive the virtual position; a short idle after
// wheel, or the end of a drag's momentum, snaps to the nearest value. When the
// wheel is readonly/disabled/busy the interaction gate (attemptInteraction)
// shows the matching callout instead of moving, and traps the page scroll.
const useWheelInteractions = ({
  ref,
  isHorizontal,
  isLoop,
  interactive,
  posRef,
  trackedItemsRef,
  clampNumber,
  attemptInteraction,
  cancelAnim,
  setPos,
  snapPosToRow,
  getItemSize,
  viewportMain,
  settle,
  wheelSettle,
  glideTo,
  stepTarget,
}) => {
  useLayoutEffect(() => {
    const el = ref.current;
    const vp = el.querySelector(".navi_wheel_viewport");
    let settleTimer = null;
    // Last wheel event's scroll velocity (px/ms, signed) and timestamp, so the
    // settle can snap to the row the scroll was heading for (see wheelSettle).
    let wheelVelocity = 0;
    let lastWheelTime = 0;
    // Set on the first event of a gesture to force the settle onto the adjacent row
    // (native-like: the slightest scroll still snaps to the next item); null once
    // the gesture continues, so momentum projection takes over.
    let wheelForcedTarget = null;

    // Non-wheel settle (drag momentum, programmatic jump): spring to the nearest row.
    const scheduleSettle = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => settle(vp, 0), 90);
    };
    // Wheel settle: fire soon after the last wheel event and land on the projected
    // row (velocity-biased), not after a long idle then a spring to nearest.
    const scheduleWheelSettle = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(
        () => wheelSettle(vp, wheelVelocity, wheelForcedTarget),
        WHEEL_SETTLE_DELAY,
      );
    };

    // Once this wheel has claimed a wheel gesture, keep swallowing the rest of that
    // gesture's events even if the pointer drifts off onto the page — otherwise the
    // document scrolls under the leftover events, which feels broken (especially when
    // the wheel was readonly and only showed a callout). A document-level capture
    // listener preventDefaults wheel events that are NOT on our scroll surface (the
    // viewport `vp`); it self-removes once a gesture-length gap passes, so a
    // genuinely new gesture on the page scrolls normally. The check is `vp`, not
    // `el`: an event inside the container but outside the viewport (padding, the
    // overlays) isn't handled by our onWheel, so it too must be prevented or it
    // would scroll an ancestor.
    let gestureGuardTimer = null;
    const onDocumentWheel = (documentWheelEvent) => {
      if (vp.contains(documentWheelEvent.target)) {
        return; // on the scroll surface → its own onWheel handles it
      }
      documentWheelEvent.preventDefault();
      keepClaimingGesture(); // the gesture continues elsewhere → keep swallowing it
    };
    const stopClaimingGesture = () => {
      clearTimeout(gestureGuardTimer);
      gestureGuardTimer = null;
      document.removeEventListener("wheel", onDocumentWheel, { capture: true });
    };
    const keepClaimingGesture = () => {
      if (!gestureGuardTimer) {
        document.addEventListener("wheel", onDocumentWheel, {
          capture: true,
          passive: false,
        });
      }
      clearTimeout(gestureGuardTimer);
      gestureGuardTimer = setTimeout(
        stopClaimingGesture,
        WHEEL_GESTURE_MAX_GAP,
      );
    };

    const onWheel = (e) => {
      const raw = isHorizontal ? e.deltaX || e.deltaY : e.deltaY;
      if (!raw) {
        return;
      }
      // Normalise to pixels: line-mode → one row, page-mode → a viewport.
      let delta = raw;
      if (e.deltaMode === 1) {
        delta = raw * getItemSize(vp);
      } else if (e.deltaMode === 2) {
        delta = raw * viewportMain(vp);
      }
      // Cap one wheel step to a single row so a chunky mouse notch (often ~100px)
      // advances one value like a native picker, instead of jumping three. A
      // trackpad's small deltas stay under the cap and scroll smoothly.
      const itemSize = getItemSize(vp);
      if (delta > itemSize) {
        delta = itemSize;
      } else if (delta < -itemSize) {
        delta = -itemSize;
      }
      attemptInteraction({
        event: e,
        name: "scroll",
        allowed: () => {
          // Always trap the scroll (like overscroll-behavior: contain): the page
          // never scrolls from within a wheel, even at a bounded end. setPos clamps
          // a non-looping wheel, so an overscroll past the end is simply a no-op.
          e.preventDefault();
          cancelAnim();
          // Track the scroll velocity (px/ms, capped) so the settle lands on the row
          // the scroll was heading for. Clamp dt so a first event / long pause after
          // one doesn't blow the estimate up.
          const now = performance.now();
          const gap = now - lastWheelTime;
          const dt = clampNumber(gap, 8, 120);
          lastWheelTime = now;
          wheelVelocity = clampNumber(
            delta / dt,
            -WHEEL_MAX_VELOCITY,
            WHEEL_MAX_VELOCITY,
          );
          // First event of a fresh gesture: advance one item whatever the delta, so
          // even the lightest scroll snaps to the next (like native scroll-snap on a
          // section). Force the settle onto the adjacent row in the scroll direction.
          if (gap > WHEEL_GESTURE_MAX_GAP && itemSize > 0) {
            let target =
              snapPosToRow(vp, posRef.current) +
              (delta < 0 ? -itemSize : itemSize);
            if (!isLoop) {
              const count = trackedItemsRef.current.length;
              target = clampNumber(target, 0, (count - 1) * itemSize);
            }
            wheelForcedTarget = target;
          } else {
            wheelForcedTarget = null;
          }
          setPos(vp, posRef.current + delta);
          scheduleWheelSettle();
          keepClaimingGesture();
        },
        prevented: () => {
          // Blocked (readonly/disabled/busy): the gate showed the callout; trap
          // the scroll so the page doesn't move under the control the user is
          // trying to use, now and for the rest of this gesture even off-element.
          e.preventDefault();
          keepClaimingGesture();
        },
      });
    };

    // Programmatic scroll: move by detail.delta px (and/or detail.items rows),
    // then snap — mirroring element.scrollBy. behavior "smooth" glides then
    // snaps; otherwise it jumps and snaps like a wheel tick. There is no native
    // scroller to drive here, so this is the seam external code (e.g. a demo
    // comparing this wheel against a native scroll-snap list) uses to move it.
    const onNaviScroll = (e) => {
      if (!e.detail) {
        return;
      }
      let delta = e.detail.delta || 0;
      if (e.detail.items) {
        delta += e.detail.items * getItemSize(vp);
      }
      if (!delta) {
        return;
      }
      attemptInteraction({
        event: e,
        name: "scroll",
        allowed: () => {
          cancelAnim();
          if (e.detail.behavior === "smooth") {
            // Glide to the nearest row after the nudge (a sub-row nudge springs
            // back); a whole-row/items delta already lands on a row.
            glideTo(vp, snapPosToRow(vp, posRef.current + delta));
          } else {
            setPos(vp, posRef.current + delta);
            scheduleSettle();
          }
        },
      });
    };

    // Cursor by POSITION, not by which row is under the pointer: the center
    // window (already-selected value) is a plain cursor, everywhere else is a
    // pointer (click to select). Set on the viewport — the rows inherit it — so a
    // fixed mouse doesn't flicker between default/pointer as rows scroll under it.
    const updateCursor = (e) => {
      if (!interactive) {
        vp.style.cursor = "default";
        return;
      }
      const rect = vp.getBoundingClientRect();
      const along = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top;
      const size = isHorizontal ? rect.width : rect.height;
      const half = getItemSize(vp) / 2;
      const mid = size / 2;
      const inCenter = along >= mid - half && along <= mid + half;
      vp.style.cursor = inCenter ? "default" : "pointer";
    };

    let drag = null;
    const onPointerDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) {
        return;
      }
      attemptInteraction({
        event: e,
        name: "select",
        allowed: () => {
          // Do NOT cancel the glide here: a click that isn't a drag should let the
          // in-flight glide keep running and just nudge its target (smooth, like
          // arrows). The glide is only cancelled once a real drag starts (below).
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
          // Capture on pointerDOWN, not on first move: a fast drag can leave the
          // viewport before the first pointermove fires, and without capture the
          // pointerup then lands outside and is never caught — leaving `drag` set
          // so the wheel keeps scrolling after release. Capture routes every
          // move/up back here regardless of where the pointer goes.
          try {
            vp.setPointerCapture(e.pointerId);
            drag.captured = true;
          } catch {
            // pointer already gone (e.g. released same tick) — nothing to capture.
          }
        },
      });
    };
    const onPointerMove = (e) => {
      if (!drag) {
        updateCursor(e); // hovering (no button): keep the position cursor fresh
        return;
      }
      if (e.pointerId !== drag.pointerId) {
        return;
      }
      // Safety net for a missed pointerup: if the mouse button is no longer held
      // while we still think we're dragging, the release was lost (it can land
      // outside a capture, or be swallowed). End the drag now instead of letting
      // the wheel keep following the released pointer. Only for mouse — touch/pen
      // report buttons=0 during a normal move, so we rely on pointerup/cancel there.
      if (e.pointerType === "mouse" && e.buttons === 0) {
        endDrag(e);
        return;
      }
      const client = isHorizontal ? e.clientX : e.clientY;
      if (!drag.moved && Math.abs(client - drag.startClient) > 3) {
        // A real drag begins: stop the glide and re-anchor to here so the wheel
        // doesn't jump (startPos = the just-frozen position, startClient = now).
        drag.moved = true;
        cancelAnim();
        drag.startPos = posRef.current;
        drag.startClient = client;
      }
      if (!drag.moved) {
        return;
      }
      const total = client - drag.startClient;
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
    const endDrag = (e) => {
      const wasDrag = drag.moved;
      let velocity = drag.velocity;
      // If the pointer sat still for a moment before release, don't fling: a stale
      // velocity from an earlier fast move would send the wheel gliding after the
      // user had already stopped. (No pointermove fires while still, so the last
      // computed velocity lingers.)
      if (performance.now() - drag.lastTime > 60) {
        velocity = 0;
      }
      if (drag.captured) {
        try {
          vp.releasePointerCapture(drag.pointerId);
        } catch {
          // capture already lost (e.g. the pointer is gone) — nothing to release.
        }
      }
      drag = null;
      if (!wasDrag) {
        // A tap: step by the click's row-distance from the center window, NOT by
        // the item under the pointer. The pointer sits over a static zone while
        // rows scroll beneath it, so a fast series of clicks in the "one below"
        // zone each add +1 to the target and accumulate — the glide catches up.
        const rect = vp.getBoundingClientRect();
        const along = isHorizontal
          ? e.clientX - rect.left
          : e.clientY - rect.top;
        const size = isHorizontal ? rect.width : rect.height;
        const offset = Math.round((along - size / 2) / getItemSize(vp));
        if (offset !== 0) {
          stepTarget(vp, offset, e);
        } else {
          // Clicked the center zone: no step, but the pointerdown cancelled any
          // in-flight glide (freezing the position), so snap cleanly to the row.
          settle(vp, 0);
        }
        return;
      }
      // Position moves opposite to the finger.
      settle(vp, -velocity);
    };
    const onPointerUp = (e) => {
      if (!drag || e.pointerId !== drag.pointerId) {
        return;
      }
      endDrag(e);
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    vp.addEventListener("pointerdown", onPointerDown);
    vp.addEventListener("pointermove", onPointerMove);
    vp.addEventListener("pointerup", onPointerUp);
    vp.addEventListener("pointercancel", onPointerUp);
    // Losing capture (Esc, the browser stealing the pointer, a torn-down node)
    // ends the gesture too — otherwise the drag would stay latched.
    vp.addEventListener("lostpointercapture", onPointerUp);
    el.addEventListener("navi_scroll", onNaviScroll);
    return () => {
      clearTimeout(settleTimer);
      stopClaimingGesture();
      cancelAnim();
      vp.removeEventListener("wheel", onWheel);
      vp.removeEventListener("pointerdown", onPointerDown);
      vp.removeEventListener("pointermove", onPointerMove);
      vp.removeEventListener("pointerup", onPointerUp);
      vp.removeEventListener("pointercancel", onPointerUp);
      vp.removeEventListener("lostpointercapture", onPointerUp);
      el.removeEventListener("navi_scroll", onNaviScroll);
    };
  }, [isLoop, isHorizontal, interactive]);
};

// Keyboard: the spinbutton container is the single focusable element. The
// main-axis arrows step the value by one row (a fast, focus-free value change,
// unlike a radio group that moves DOM focus per step); the value updates
// immediately (for AT) while the row glides to center. Home/End jump to the ends.
// Keys the wheel doesn't step on (Enter, Escape, …) are forwarded to the facade
// input handler so the wheel submits/cancels like any control. Cross-axis arrows
// are left for the WheelGroup to move focus between wheels.
const useWheelKeyboard = ({
  ref,
  isHorizontal,
  isLoop,
  interactive,
  trackedItemsRef,
  hostKeyDownRef,
  attemptInteraction,
  glideToIndex,
  stepTarget,
}) => {
  useLayoutEffect(() => {
    const el = ref.current;
    const vp = el.querySelector(".navi_wheel_viewport");
    const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
    const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";
    const stepKeys = new Set([prevKey, nextKey, "Home", "End"]);
    const onKeyDown = (e) => {
      if (!stepKeys.has(e.key)) {
        // Keys the wheel doesn't step on (Enter, Escape, …) go to the facade
        // input handler so the wheel behaves like any other control: Enter
        // submits the enclosing form or sends the enclosing picker, Escape
        // closes it. See hostKeyDownRef above.
        hostKeyDownRef.current?.(e);
        return;
      }
      // Swallow the key in both branches (so arrows never scroll the page); a
      // blocked wheel (readonly is focusable, so arrows can reach it) pops the
      // matching callout instead of stepping.
      attemptInteraction({
        event: e,
        name: "step",
        allowed: () => {
          e.preventDefault();
          if (e.key === "Home" || e.key === "End") {
            const count = trackedItemsRef.current.length;
            if (!count) {
              return;
            }
            glideToIndex(vp, e.key === "Home" ? 0 : count - 1, e);
          } else {
            // Steps from the TARGET, so a second press mid-glide accumulates (the
            // spring accelerates toward the farther target).
            stepTarget(vp, e.key === nextKey ? 1 : -1, e);
          }
        },
        prevented: () => {
          e.preventDefault();
        },
      });
    };
    el.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("keydown", onKeyDown);
    };
  }, [isHorizontal, interactive, isLoop]);
};

function WheelUI(props) {
  import.meta.css = css;
  const {
    ref,
    visibleCount = 3,
    itemHeight,
    itemWidth,
    bounded,
    horizontal,
    glass,
    frameBorder,
    glideSpeed = WHEEL_GLIDE_SPEED,
    type,
    style,
  } = props;
  const group = useContext(WheelGroupContext);
  const isHorizontal = Boolean(horizontal ?? group?.horizontal);
  // A wheel turns by default; `bounded` gives it fixed ends (no wrap).
  const isLoop = !bounded;
  // Glass: frost the neighbouring rows so the center reads as a clear "window"
  // (like the iOS picker). frameBorder lines the window edges (independent).
  // Both inherited from a WheelGroup so a whole group is styled with one prop.
  const showGlass = Boolean(glass ?? group?.glass);
  const showFrameBorder = Boolean(frameBorder ?? group?.frameBorder);

  // Collect every Wheel.Item's {value, label, itemProps} in order, robustly
  // (children may be wrapped). This ordered list is the source of truth for the
  // whole wheel — the rendered rows are a small recycled window over it.
  const tracker = useItemTracker();
  const indexRef = useRef(0);
  indexRef.current = 0;
  const trackerContextRef = useRef(null);
  if (!trackerContextRef.current) {
    trackerContextRef.current = { tracker, indexRef };
  }
  const trackedItems = tracker.itemsSignal.value;
  const trackedItemsRef = useRef(trackedItems);
  trackedItemsRef.current = trackedItems;
  const itemCount = trackedItems.length;

  // Virtualization: render only visibleCount + 2 rows (one buffer each side to
  // cover the partial rows a scroll reveals + a re-render's one-frame lag) and
  // recycle them, filling each from trackedItems. `centerRowSignal` holds the row
  // currently at the center (round(pos / itemSize)); it changes only when the
  // wheel crosses a row (not every frame), so the window re-renders on demand, not
  // per frame. WheelWindow derives its top slot (base) from that row and its own
  // windowSize — so a windowSize change (items still registering) recomputes base
  // instead of leaving the top rows unrendered. The per-frame transform is
  // imperative (--wheel-offset); renderedBaseRef mirrors the base the DOM shows so
  // the transform stays consistent with it.
  // visibleCount + 2, but never more rows than there are values.
  let windowSize = visibleCount + 2;
  if (windowSize > itemCount) {
    windowSize = itemCount;
  }
  const centerRowSignal = useSignal(0);
  const renderedBaseRef = useRef(0);
  // Which window slot currently carries data-wheel-current (the center row).
  const markedSlotRef = useRef(-1);
  // Row size in px, measured once from a rendered slot (rows are uniform).
  const itemSizeRef = useRef(0);

  // A single value control backed by a hidden input (facade pattern, like
  // Picker): `ref` is the visible spinbutton container; `inputRef` the hidden
  // <input> holding the value for the form.
  //
  // type="navi_js" is what keeps the value TYPED end to end. Wheel.Item values
  // are arbitrary JS (numbers, ISO strings, day objects…); a plain text input
  // would let readControlValue read them back as DOM strings — the framework
  // re-syncs uiState from the input after every change, so `9` would come back as
  // "9" and action/aria would see a string. navi_js makes readControlValue return
  // the controller's real JS value instead (same mechanism Picker uses for its
  // complex values). The wheel's own `type` prop ("integer", "day"…) is a
  // rendering hint kept on the container (data-wheel-type), never on the input.
  const inputRef = useRef(null);
  const [controlRootProps, controlHostProps, { facadeController }] =
    useControlFacadeProps(
      {
        ...props,
        ref: inputRef,
        type: "navi_js",
      },
      { controlType: "input" },
    );
  const uiStateController = getUIStateControllerById(controlHostProps.id);
  const { basePseudoState, children } = controlHostProps;
  // The facade's own keydown handler (Enter → submit form / send picker, Escape
  // → close, …) is wired to the hidden input, which is never focused (focus is
  // on the spinbutton container). Held in a ref so the container's keydown
  // effect can forward the keys it doesn't handle to it — mirroring how
  // picker.jsx re-dispatches bubbling keydowns to its input. Recreated each
  // render, so a stable ref (not a dependency) keeps the effect from re-binding.
  const hostKeyDownRef = useRef();
  hostKeyDownRef.current = controlHostProps.onKeyDown;
  const loading = basePseudoState[":-navi-loading"];
  const readOnly = basePseudoState[":read-only"];
  const disabled = basePseudoState[":disabled"];
  // Scroll/arrows/clicks must not change a readonly, disabled or loading (busy)
  // wheel — the controlled value stays authoritative and any scroll springs back
  // to it. Interaction attempts still go through the gate (attemptInteraction) so
  // the matching readonly/disabled/busy callout is shown.
  const interactive = !readOnly && !disabled && !loading;
  // The typed selected value (see the navi_js note above): what the rest of the
  // file compares (compareTwoJsValues) and exposes (action/uiAction, aria).
  const currentValue = uiStateController.uiState;
  for (const key of WHEEL_OWN_PROP_KEYS) {
    delete controlRootProps[key];
  }

  // Long-lived event effects (keydown, pointer/wheel) are bound once but read the
  // value and item list here; a plain closure would freeze the mount render's
  // values (empty item list, initial value) and later clear or mis-map the
  // selection. Refs keep the mapping helpers reading fresh data.
  const currentValueRef = useRef(currentValue);
  currentValueRef.current = currentValue;

  // Ask the framework to change the value; the controlled value / action flow
  // then updates uiState, which syncCenterToSelection reacts to. Callers reach
  // this only when interactive (the gate blocks readonly/disabled/busy upstream).
  const requestSelectValue = (newValue, event) => {
    if (compareTwoJsValues(newValue, currentValueRef.current)) {
      return;
    }
    dispatchRequestSetUIState(inputRef.current, newValue, { event });
  };

  // Gate a user gesture (scroll, drag, tap, arrow) through the framework's
  // interactivity check. When the wheel is readonly/disabled/busy the gate pops
  // the matching callout and runs `prevented`; otherwise it runs `allowed`. One
  // path covers all three blocked states. Params are forwarded to
  // dispatchRequestInteraction verbatim — { event, name, allowed, prevented }.
  //
  // Do NOT preventDefault the event before calling this: the gate refuses an
  // already-defaultPrevented event, so it would read every gesture as blocked.
  // preventDefault inside `allowed`/`prevented` once we know what to do with it.
  const attemptInteraction = (params) => {
    dispatchRequestInteraction(inputRef.current, params);
  };

  // Map a value to its index in the tracked list (the selection is one value,
  // located in the ordered data — not a DOM row). -1 when absent.
  const getIndexForValue = (value) => {
    return trackedItemsRef.current.findIndex((it) =>
      compareTwoJsValues(it.value, value),
    );
  };

  // What the spinbutton announces. currentValue is already the typed item value.
  // aria-valuenow carries it whether numeric or a short string (e.g. "M"); a
  // richer label ("Monday, July 28") goes on aria-valuetext. When every item is
  // numeric, aria-valuemin/valuemax bound the range for assistive tech.
  const selectedTracked = trackedItems.find((it) =>
    compareTwoJsValues(it.value, currentValue),
  );
  const ariaValueNow =
    typeof currentValue === "number" || typeof currentValue === "string"
      ? currentValue
      : undefined;
  let ariaValueText;
  if (selectedTracked && typeof selectedTracked.label === "string") {
    ariaValueText = selectedTracked.label;
  } else {
    ariaValueText = undefined;
  }
  const numericRange = getNumericRange(trackedItems);

  // The value index we are heading to (the glide/selection target). Guards the
  // effects so an external value change (or the initial mount) scrolls into place,
  // while our own scroll-driven selection does not scroll a second time. Holds the
  // TARGET so rapid inputs step from it and accumulate. null = nothing pending.
  const centeredIndexRef = useRef(null);
  // The wheel does NOT use native scroll. `posRef` is our own virtual scroll
  // position (px, main axis); the list track is translated by -pos. This is the
  // single source of truth, wrapped modulo the real-list extent in loop mode, so
  // there is no physical scroll edge to get stuck at.
  const posRef = useRef(0);
  // momentumRef: the fling/settle rAF (velocity decay → snap).
  const momentumRef = useRef(null);
  // The discrete glide is a spring toward targetPosRef: arrow keys and clicks set
  // the target (accumulating — each press/click moves it another row), and one
  // rAF loop (glideRef) chases it. The chase LAGS the target on purpose, so N fast
  // inputs land N rows away and the animation catches up; a farther target springs
  // faster, so a second press mid-glide reads as accelerating, not restarting.
  const targetPosRef = useRef(null);
  const glideRef = useRef(null);
  // The glide loop is bound once (mount effect) but the speed can change live
  // (e.g. a demo control) — read it through a ref so it uses the latest.
  const glideSpeedRef = useRef(glideSpeed);
  glideSpeedRef.current = glideSpeed;

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

  // Main-axis size of the viewport, from the orientation.
  const viewportMain = (vp) =>
    isHorizontal ? vp.clientWidth : vp.clientHeight;

  // Row size (px). Rows are uniform, so one measurement (cached) drives all the
  // geometry — positions are then computed from value indices, not read off the
  // DOM. Measured from a rendered window slot; refreshed while still 0.
  const getItemSize = (vp) => {
    if (itemSizeRef.current > 0) {
      return itemSizeRef.current;
    }
    const slot = vp.querySelector(".navi_wheel_item");
    const size = slot
      ? isHorizontal
        ? slot.offsetWidth
        : slot.offsetHeight
      : 0;
    if (size > 0) {
      itemSizeRef.current = size;
    }
    return size;
  };

  const getViewport = () => ref.current?.querySelector(".navi_wheel_viewport");
  const getTrack = (vp) => vp.querySelector(".navi_wheel_list");

  const clampNumber = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  // An index wrapped into [0, count) when looping, else clamped.
  const wrapIndex = (index) => {
    const count = trackedItemsRef.current.length;
    if (count === 0) {
      return 0;
    }
    return isLoop
      ? ((index % count) + count) % count
      : clampNumber(index, 0, count - 1);
  };

  // Push the current position onto the track and re-render the recycled window ON
  // DEMAND. Every frame the transform (--wheel-offset) is updated imperatively
  // (cheap); the window's slot VALUES re-render only when the top value index
  // changes (i.e. we cross a row), via baseIndexSignal. renderedBaseRef mirrors
  // the base the DOM currently shows, so the imperative transform stays consistent
  // with it even when a re-render lags a frame — the buffer row absorbs the gap.
  // The transform that positions the track so the value at pos/itemSize sits in
  // the center window, given the base value the DOM currently shows
  // (renderedBaseRef). Snap to a whole pixel (a transformed row's text renders 1px
  // off a static element at a half-pixel; the separators share this line-height to
  // match the grid).
  const applyOffset = (vp) => {
    const track = getTrack(vp);
    const size = getItemSize(vp);
    if (!track || size === 0) {
      return;
    }
    const t =
      viewportMain(vp) / 2 -
      size / 2 -
      posRef.current +
      renderedBaseRef.current * size;
    track.style.setProperty("--wheel-offset", `${Math.round(t)}px`);
    // Mark the row currently in the center window (its value is the selection).
    // The slot recycles, so the marked node changes as we scroll — move the
    // attribute only when the center slot index actually changes. Only [disabled]
    // styling reads it; the fade/focus-ring center is geometric (CSS).
    const centerSlot =
      Math.round(posRef.current / size) - renderedBaseRef.current;
    if (centerSlot !== markedSlotRef.current) {
      const slots = track.children;
      const previous = slots[markedSlotRef.current];
      if (previous) {
        previous.removeAttribute("data-wheel-current");
      }
      const current = slots[centerSlot];
      if (current) {
        current.setAttribute("data-wheel-current", "");
      }
      markedSlotRef.current = centerSlot;
    }
  };
  const renderPos = (vp) => {
    const size = getItemSize(vp);
    const count = trackedItemsRef.current.length;
    if (size === 0 || count === 0) {
      return;
    }
    // Publish the center row; WheelWindow turns it into the top slot (base). The
    // signal only fires on a row change, so the window re-renders on demand.
    const row = Math.round(posRef.current / size);
    if (row !== centerRowSignal.peek()) {
      centerRowSignal.value = row;
    }
    applyOffset(vp);
  };
  // The window subcomponent calls this once it has committed a new base to the
  // DOM: sync renderedBaseRef then re-apply the offset so the imperative transform
  // matches the freshly rendered rows within the same frame (no jump).
  const commitRenderedBase = (base) => {
    renderedBaseRef.current = base;
    const vp = getViewport();
    if (vp) {
      applyOffset(vp);
    }
  };

  // The value index at the center for the current position.
  const centeredIndex = (vp) => {
    const size = getItemSize(vp);
    return size === 0 ? 0 : wrapIndex(Math.round(posRef.current / size));
  };

  // The canonical position that centers value `index` (index * itemSize). For a
  // loop, glideTargetFor picks the copy nearest the current pos so a wrap goes the
  // short way round instead of unwinding the whole list.
  const centerPosFor = (vp, index) => index * getItemSize(vp);
  const glideTargetFor = (vp, index) => {
    const canonical = centerPosFor(vp, index);
    const span = trackedItemsRef.current.length * getItemSize(vp);
    if (!isLoop || span === 0) {
      return canonical;
    }
    return canonical + Math.round((posRef.current - canonical) / span) * span;
  };

  // Nearest whole-row position to `pos` (rows are spaced by itemSize).
  const snapPosToRow = (vp, pos) => {
    const size = getItemSize(vp);
    return size === 0 ? pos : Math.round(pos / size) * size;
  };

  // Bounded: clamp so the first/last value can't be scrolled past center. A loop
  // never clamps — its position is free and folds back to a canonical value on
  // settle (commitSelection) so it can't drift unbounded.
  const clampPos = (vp) => {
    const size = getItemSize(vp);
    const count = trackedItemsRef.current.length;
    if (count === 0 || size === 0) {
      return;
    }
    posRef.current = clampNumber(posRef.current, 0, (count - 1) * size);
  };

  const setPos = (vp, pos) => {
    posRef.current = pos;
    if (!isLoop) {
      clampPos(vp);
    }
    renderPos(vp);
  };

  const cancelAnim = () => {
    if (momentumRef.current !== null) {
      cancelAnimationFrame(momentumRef.current);
      momentumRef.current = null;
    }
    if (glideRef.current !== null) {
      cancelAnimationFrame(glideRef.current);
      glideRef.current = null;
      targetPosRef.current = null;
    }
  };

  // After motion stops: fold a looped position back to the centered value's
  // canonical spot (index*itemSize) so it can't drift unbounded, then select it.
  // The fold happens here at rest, atomically with the settle re-render, so the
  // window/transform stay consistent (no mid-glide fold).
  const commitSelection = (vp) => {
    const size = getItemSize(vp);
    const count = trackedItemsRef.current.length;
    if (size === 0 || count === 0) {
      return;
    }
    const index = centeredIndex(vp);
    if (isLoop) {
      posRef.current = index * size;
      renderPos(vp);
    }
    if (!interactive) {
      return;
    }
    centeredIndexRef.current = index;
    requestSelectValue(
      trackedItemsRef.current[index].value,
      new CustomEvent("navi_wheel_settle"),
    );
  };

  // Glide toward `target` with a spring: one rAF loop chases targetPosRef, moving
  // a fraction of the remaining distance each frame (so it eases out into place)
  // and continuing from wherever it is when the target moves (so a second input
  // mid-glide accelerates toward the farther target instead of restarting). The
  // position runs free (the window recycles values as it goes); it commits and
  // folds back to a canonical spot on arrival.
  const glideStep = (vp, prevTime) => {
    const now = performance.now();
    const dt = clampNumber(now - prevTime, 0, 32);
    const target = targetPosRef.current;
    if (target === null) {
      glideRef.current = null;
      return;
    }
    const dist = target - posRef.current;
    // < ~half a pixel from target → snap, commit, done.
    if (Math.abs(dist) < 0.4) {
      posRef.current = target;
      targetPosRef.current = null;
      glideRef.current = null;
      renderPos(vp);
      commitSelection(vp);
      return;
    }
    // Frame-rate-independent spring. Stiffness scales with glideSpeed so the demo
    // control still slows it down; a farther target moves faster (distance × factor).
    const factor = 1 - Math.pow(1 - glideSpringFactor(), dt / 16);
    posRef.current += dist * factor;
    renderPos(vp);
    glideRef.current = requestAnimationFrame(() => glideStep(vp, now));
  };
  // Spring stiffness (fraction of remaining distance per ~frame). Scales with the
  // glide speed so slower = gentler chase; clamped so it never crawls or snaps.
  const glideSpringFactor = () =>
    clampNumber(glideSpeedRef.current * 1.4, 0.06, 0.45);
  const glideTo = (vp, target) => {
    // A discrete glide overrides any fling momentum.
    if (momentumRef.current !== null) {
      cancelAnimationFrame(momentumRef.current);
      momentumRef.current = null;
    }
    targetPosRef.current = target;
    if (glideRef.current === null) {
      glideRef.current = requestAnimationFrame(() =>
        glideStep(vp, performance.now()),
      );
    }
    // else: the loop is already running and will chase the updated target — no
    // restart, so rapid inputs read as one accelerating motion, not a stutter.
  };

  // Settle after user input (fling or idle): a single continuous motion that
  // decays the initial velocity, then — once slow — springs into the nearest row
  // center. Momentum and snap are the same loop, so it eases into place instead
  // of momentum-then-abrupt-jump. Velocity is capped so even a violent fling
  // overshoots only a handful of rows (a picker isn't a free-scrolling list).
  const settle = (vp, velocity) => {
    cancelAnim();
    let v = clampNumber(velocity, -WHEEL_MAX_VELOCITY, WHEEL_MAX_VELOCITY);
    let last = performance.now();
    let snapping = Math.abs(v) < WHEEL_SNAP_VELOCITY;
    const step = (now) => {
      const dt = clampNumber(now - last, 0, 32);
      last = now;
      if (!snapping) {
        v *= Math.pow(WHEEL_DECAY, dt / 16);
        setPos(vp, posRef.current + v * dt);
        if (Math.abs(v) < WHEEL_SNAP_VELOCITY) {
          snapping = true;
        }
        momentumRef.current = requestAnimationFrame(step);
        return;
      }
      const snapTo = snapPosToRow(vp, posRef.current);
      const dist = snapTo - posRef.current;
      if (Math.abs(dist) < 0.4) {
        setPos(vp, snapTo);
        momentumRef.current = null;
        commitSelection(vp);
        return;
      }
      setPos(vp, posRef.current + dist * WHEEL_SPRING_FACTOR);
      momentumRef.current = requestAnimationFrame(step);
    };
    momentumRef.current = requestAnimationFrame(step);
  };

  // Wheel gesture end: land on the row the scroll was heading for. The position
  // is biased by the last scroll velocity before snapping, so a flick that stopped
  // just short of the next row still lands ON it (never snaps backward), and the
  // glide there decelerates as the motion dies — no separate spring-to-nearest, no
  // long idle wait. velocity is px/ms, signed with the scroll direction.
  // `forcedTarget` (px) overrides the projection — used by the first event of a
  // gesture to always advance one item, however small the delta (see onWheel).
  const wheelSettle = (vp, velocity, forcedTarget) => {
    cancelAnim();
    const size = getItemSize(vp);
    if (size === 0) {
      return;
    }
    let target =
      forcedTarget !== null && forcedTarget !== undefined
        ? forcedTarget
        : snapPosToRow(vp, posRef.current + velocity * WHEEL_MOMENTUM_MS);
    // Bounded: never glide past the first/last row. glideStep sets pos directly
    // (no setPos clamp), so a high leftover velocity — e.g. flicking hard to the
    // end then whipping the mouse off the wheel before it decays — would otherwise
    // project a target beyond the end and leave the wheel overscrolled there.
    if (!isLoop) {
      const count = trackedItemsRef.current.length;
      target = clampNumber(target, 0, (count - 1) * size);
    }
    glideTo(vp, target);
  };

  // Center value `index` (external value / initial / keyboard / click). Smooth
  // glides to the nearest copy (glideTargetFor) so a wrap goes the short way.
  const centerOnIndex = (vp, index, behavior) => {
    const target = glideTargetFor(vp, index);
    if (behavior === "smooth") {
      glideTo(vp, target);
    } else {
      setPos(vp, target);
    }
  };

  // Select value `index`: update the value immediately (so N inputs land N rows
  // away right now) and glide there (the animation lags and catches up).
  // centeredIndexRef holds the TARGET so the next input steps from it — rapid
  // inputs accumulate.
  const glideToIndex = (vp, index, event) => {
    centeredIndexRef.current = index;
    requestSelectValue(trackedItemsRef.current[index].value, event);
    centerOnIndex(vp, index, "smooth");
  };
  // Index we are heading to (the target, not the mid-glide visual center).
  const currentTargetIndex = (vp) => {
    let index = centeredIndexRef.current;
    if (index === null) {
      index = getIndexForValue(currentValueRef.current);
    }
    if (index < 0 || index === null) {
      index = centeredIndex(vp);
    }
    if (index < 0) {
      index = 0;
    }
    return index;
  };
  // Move the target by `offset` rows (arrow key = ±1, click = its distance from
  // the center window). Relative to the current target so it accumulates.
  const stepTarget = (vp, offset, event) => {
    if (trackedItemsRef.current.length === 0) {
      return;
    }
    const index = currentTargetIndex(vp);
    glideToIndex(vp, wrapIndex(index + offset), event);
  };

  // Sync the center with the current value — used on first display and whenever
  // the controlled value changes from outside.
  const syncCenterToSelection = (viewportEl, behavior) => {
    // A glide or momentum in flight (tap, arrow, fling) is already taking the
    // wheel to the right row. This runs on every controlled-value re-render, which
    // lags a frame behind our own centeredIndexRef — so on rapid taps its guard
    // below would miss and it would snap instantly mid-glide, leaving the wheel
    // stuck off-center. Let the motion finish: commitSelection settles the value
    // and the next render is a no-op. A genuine external change made during motion
    // is honoured once it settles (centeredIndexRef then differs from selection).
    if (glideRef.current !== null || momentumRef.current !== null) {
      return;
    }
    if (trackedItemsRef.current.length === 0) {
      return;
    }
    let selectedIndex = getIndexForValue(currentValueRef.current);
    if (selectedIndex < 0) {
      selectedIndex = 0;
    }
    if (selectedIndex === centeredIndexRef.current) {
      return;
    }
    centeredIndexRef.current = selectedIndex;
    centerOnIndex(viewportEl, selectedIndex, behavior);
  };
  // The deferred re-center below fires a frame later, by which point the items
  // have registered and the value has resolved; a closure would still hold the
  // mount render's empty item list and re-center on the first row. A ref always
  // points at the current render's syncCenterToSelection.
  const syncCenterToSelectionRef = useRef(null);
  syncCenterToSelectionRef.current = syncCenterToSelection;

  // Initial centering — deferred until the wheel is on screen (offsets need real
  // layout, e.g. not inside a closed popover/dialog).
  useDisplayedLayoutEffect(
    ref,
    (el) => {
      const vp = el.querySelector(".navi_wheel_viewport");
      syncCenterToSelectionRef.current(vp, "auto");
      // Re-center once more after a frame: the first pass can run before the flex
      // rows get their final offsets (or before the items have registered), which
      // would leave the selected value off the center window until the first
      // interaction. Recompute from stable layout so it sits in the window from
      // the start.
      const rafId = requestAnimationFrame(() => {
        centeredIndexRef.current = null;
        syncCenterToSelectionRef.current(vp, "auto");
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

  useWheelInteractions({
    ref,
    isHorizontal,
    isLoop,
    interactive,
    posRef,
    trackedItemsRef,
    clampNumber,
    attemptInteraction,
    cancelAnim,
    setPos,
    snapPosToRow,
    getItemSize,
    viewportMain,
    settle,
    wheelSettle,
    glideTo,
    stepTarget,
  });

  useWheelKeyboard({
    ref,
    isHorizontal,
    isLoop,
    interactive,
    trackedItemsRef,
    hostKeyDownRef,
    attemptInteraction,
    glideToIndex,
    stepTarget,
  });

  return (
    <Box
      ref={ref}
      {...controlRootProps}
      baseClassName="navi_wheel_container"
      // A spinbutton: one focusable element, arrows adjust the value. Disabled is
      // not focusable (no tabindex), but the wheel is deliberately NOT inert:
      // scroll/click still reach the interaction gate so the "disabled" callout
      // can be shown (inert would swallow the events silently).
      role="spinbutton"
      tabindex={disabled ? undefined : 0}
      aria-valuenow={ariaValueNow}
      aria-valuetext={ariaValueText}
      aria-valuemin={numericRange ? numericRange.min : undefined}
      aria-valuemax={numericRange ? numericRange.max : undefined}
      aria-disabled={disabled ? "true" : undefined}
      data-horizontal={isHorizontal ? "" : undefined}
      data-glass={showGlass ? "" : undefined}
      data-frame-border={showFrameBorder ? "" : undefined}
      data-wheel-type={type || undefined}
      pseudoClasses={WHEEL_PSEUDO_CLASSES}
      basePseudoState={basePseudoState}
      style={styleWithVars}
    >
      {/* The value lives in this input for the form; the wheel is its facade. An
          invisible overlay (not type=hidden) so it keeps a box the readonly/error
          callout can anchor to. It is not the focus/pointer target: the container
          is the spinbutton, the rows take the clicks. */}
      <Box
        as="input"
        {...controlHostProps}
        tabindex={-1}
        aria-hidden="true"
        className="navi_wheel_input"
        // Ensure cannot show keyboard on mobile when focused
        readOnly
        data-readonly-forced=""
        // eslint-disable-next-line react/no-children-prop
        children={undefined}
      />
      <div className="navi_wheel_outline_wrapper">
        <LoadingOutline
          loading={loading}
          color="var(--navi-loader-color)"
          inset={-1}
        />
      </div>
      <div className="navi_wheel_viewport">
        <div className="navi_wheel_pane" data-side="start" />
        {/* Wheel.Item children register their {value,label,itemProps} here and
            render nothing (see WheelItem). The visible rows are the recycled
            window below, filled from that tracked list. */}
        <WheelItemTrackerContext.Provider value={trackerContextRef.current}>
          <ControlFacadeChildrenWrapper facadeController={facadeController}>
            {children}
          </ControlFacadeChildrenWrapper>
        </WheelItemTrackerContext.Provider>
        <ul className="navi_wheel_list">
          <WheelWindow
            centerRowSignal={centerRowSignal}
            windowSize={windowSize}
            trackedItems={trackedItems}
            isLoop={isLoop}
            onBaseCommit={commitRenderedBase}
          />
        </ul>
        <div className="navi_wheel_pane" data-side="end" />
      </div>
      {/* Outside the viewport: the viewport's fade mask + glass panes must not
          dim the focus ring — it marks the center window, above all of it. */}
      <div className="navi_wheel_focus_ring" />
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

// The recycled window: a fixed set of `windowSize` <li> slots (one per visible
// row + 2 buffer), keyed by slot position so each DOM node is reused and only its
// content re-renders. `base` (the top slot's value index) is derived here from the
// center row + windowSize — computing it here, not upstream, means a windowSize
// change (items still registering) recomputes base correctly. Each slot shows
// trackedItems[base + slot] (wrapped when looping). It reads centerRowSignal, so
// it re-renders ONLY when the wheel crosses a row, not every frame — the per-frame
// motion is the imperative transform in applyOffset. On each new base it calls
// onBaseCommit so the transform re-syncs to the freshly rendered rows same-frame.
const WheelWindow = ({
  centerRowSignal,
  windowSize,
  trackedItems,
  isLoop,
  onBaseCommit,
}) => {
  const count = trackedItems.length;
  let base = centerRowSignal.value - Math.floor(windowSize / 2);
  // Non-loop: keep the window inside the value range so every slot maps to a real
  // value; the transform then leaves the blank runway above the first / below the
  // last value on its own (no rows are drawn there).
  if (!isLoop && count > 0) {
    base = base < 0 ? 0 : base > count - windowSize ? count - windowSize : base;
  }
  useLayoutEffect(() => {
    onBaseCommit(base);
  });
  const slots = [];
  for (let slot = 0; slot < windowSize; slot++) {
    let index = base + slot;
    if (isLoop) {
      index = ((index % count) + count) % count;
    }
    const item = trackedItems[index];
    slots.push(
      <Box
        as="li"
        key={slot}
        {...item.itemProps}
        baseClassName="navi_wheel_item"
      >
        {item.label}
      </Box>,
    );
  }
  return slots;
};

/**
 * Wheel.Item — a value in a Wheel. Must be used inside <Wheel>.
 *
 * Registration only: it records its {value, label, itemProps} with the wheel and
 * renders NOTHING. The wheel is virtualized — it renders a small recycled window
 * of rows and fills each from this tracked data — so the value list is the source
 * of truth, not a per-item DOM node. Selection lives on the wheel's value.
 *
 * @type {import("preact").FunctionComponent<{
 *   value: any,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 */
export const WheelItem = ({ value, id, children, ...rest }) => {
  const idDefault = useId();
  const resolvedId = id || idDefault;
  // Wheel.Item must live inside a Wheel, so the context is always present.
  const trackerContext = useContext(WheelItemTrackerContext);
  const index = trackerContext.indexRef.current++;
  trackerContext.tracker.useTrackItem({
    id: resolvedId,
    index,
    value,
    label: children,
    itemProps: rest,
  });
  return null;
};
Wheel.Item = WheelItem;

/**
 * WheelGroup — lays out several Wheels side by side with separators between
 * them (e.g. a "HH : MM : SS" time picker, or "9 hours 30 minutes").
 *
 * Put <Wheel> and <WheelGroup.Separator> as direct children. Separators take
 * their natural content width. No spacing by default; to add breathing room, pad
 * each Wheel.Item (it's a Box: paddingX="0.5ch") so the gap stays scrollable.
 * `spacing` is just the Box flex gap between children (a layout gap, not padding).
 *
 * @type {import("preact").FunctionComponent<{
 *   horizontal?: boolean,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {boolean} [props.horizontal] - Stack the (horizontal) wheels vertically instead of in a row.
 * @param {boolean} [props.glass] - Frost every wheel's neighbouring rows (see Wheel's glass prop) with one prop for the whole group.
 * @param {boolean} [props.frameBorder] - Line every wheel's center-window edges with a faint frame (off by default; independent of glass).
 */
export const WheelGroup = (props) => {
  import.meta.css = css;
  // WheelGroup IS a control group: it aggregates its named wheels ("hours",
  // "minutes"…) into one object value, so it can sit directly inside a Form or a
  // Picker with no extra <ControlGroup> wrapper. The wheel-specific presentation
  // props are consumed here; the rest flow into the group hook.
  // `spacing` is NOT consumed here — it flows through to the underlying Box as a
  // plain flex gap between the wheels/separators (not a wheel concept).
  const { horizontal, glass, frameBorder, style } = props;
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;
  const groupRef = props.ref;

  // controlType "control_group" (not a bespoke "wheel_group") so a Picker with
  // type="controlgroup" recognises this as its aggregating child (it only syncs
  // with a control_group — see useUIFacadeStateController). Named wheels aggregate
  // into { hours, minutes, … }; a nameless wheel warns (name it or it won't be in
  // the value), same as any control group.
  const [controlgroupRootProps, controlgroupProps, childrenWrapperProps] =
    useControlgroupProps(props, {
      allowCapture: true,
      wantRequesterButtonState: true,
      controlType: "control_group",
      stateType: "object",
      cascadeValidationToChildren: true,
    });
  const { children } = controlgroupProps;

  const groupStyle = {
    ...style,
  };

  // Cross-axis arrows move focus between wheels (the main axis stays within a
  // wheel, changing its value). A row of wheels → Left/Right hop columns; a
  // horizontal group stacks wheels → Up/Down hop rows. Focusing the next wheel's
  // spinbutton lets you go straight from hours to minutes.
  useLayoutEffect(() => {
    const el = groupRef.current;
    const prevKey = horizontal ? "ArrowUp" : "ArrowLeft";
    const nextKey = horizontal ? "ArrowDown" : "ArrowRight";
    const onKeyDown = (e) => {
      if (e.key !== prevKey && e.key !== nextKey) {
        return;
      }
      const active = document.activeElement;
      if (!active || !el.contains(active)) {
        return;
      }
      const currentWheel = active.closest(".navi_wheel_container");
      if (!currentWheel) {
        return;
      }
      const wheels = [...el.querySelectorAll(".navi_wheel_container")];
      const targetIndex =
        wheels.indexOf(currentWheel) + (e.key === nextKey ? 1 : -1);
      if (targetIndex < 0 || targetIndex >= wheels.length) {
        return;
      }
      const targetWheel = wheels[targetIndex];
      e.preventDefault();
      e.stopPropagation();
      targetWheel.focus();
    };
    el.addEventListener("keydown", onKeyDown, true);
    return () => {
      el.removeEventListener("keydown", onKeyDown, true);
    };
  }, [horizontal]);

  // A Box (not a plain div) so style props like border/padding work directly.
  return (
    <Box
      {...controlgroupRootProps}
      {...controlgroupProps}
      // The wheel-specific props are consumed here; blank them AFTER the spreads
      // (the group hook, not knowing them, would otherwise pass them through onto
      // the DOM as unknown attributes) — cleaner than mutating the props object.
      spacing={undefined}
      horizontal={undefined}
      glass={undefined}
      frameBorder={undefined}
      baseClassName="navi_wheel_group"
      data-horizontal={horizontal ? "" : undefined}
      style={groupStyle}
      pseudoClasses={WHEEL_GROUP_PSEUDO_CLASSES}
    >
      <WheelGroupContext.Provider value={{ glass, frameBorder, horizontal }}>
        <ControlgroupChildrenWrapper
          {...childrenWrapperProps}
          // Don't propagate the group name to children (an anonymous wheel would
          // otherwise inherit it) — each wheel is named individually.
          name={undefined}
        >
          {children}
        </ControlgroupChildrenWrapper>
      </WheelGroupContext.Provider>
    </Box>
  );
};
const WHEEL_GROUP_PSEUDO_CLASSES = [
  ":focus-within",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
/**
 * WheelGroup.Separator — content shown between wheels (":", a word, an icon…).
 * Its content sits in a one-row box that mirrors a wheel item — same full-row
 * line-height — so the glyph lands on the numbers' line (see .navi_wheel_item).
 *
 * @param {object} props
 */
const WheelGroupSeparator = ({ children, ...rest }) => {
  return (
    <Box
      as="span"
      {...rest}
      className="navi_wheel_group_separator"
      aria-hidden="true"
    >
      {children}
    </Box>
  );
};
WheelGroup.Separator = WheelGroupSeparator;

/**
 * Wheel.Colon — a ":" drawn as an SVG (not a separator; wrap it in a
 * WheelGroup.Separator to place it between wheels). A font colon sits on the
 * baseline (its dots hug the lower half of the digits, looking sunk); this one is
 * two dots symmetric about the SVG's middle, so — centered in the separator's row
 * like the numbers are in theirs — it lands on the numbers' optical center.
 */
const WheelColon = (props) => {
  return (
    <svg {...props} className="navi_wheel_colon" viewBox="0 0 8 24">
      <circle cx="4" cy="8" r="2" fill="currentColor" />
      <circle cx="4" cy="16" r="2" fill="currentColor" />
    </svg>
  );
};
Wheel.Colon = WheelColon;
