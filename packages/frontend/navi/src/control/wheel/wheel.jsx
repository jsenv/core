/*
 * Wheel — a single-value control rendered as an iOS-style scroll picker. A short
 * viewport shows the selected value in the middle with the neighbouring values
 * faded above/below (or left/right when `horizontal`). The selected value is
 * whichever item is closest to the center; the user changes it by scrolling,
 * dragging, clicking a neighbour, or with the arrow keys.
 *
 * A SPINBUTTON, NOT A RADIO GROUP. The whole wheel is one focusable element
 * (role=spinbutton, the container) whose value lives in an invisible input for
 * the form. The rows (Wheel.Item) are inert, aria-hidden <li>s that only register
 * their {value, label} with the wheel; they carry no focusable input. The
 * main-axis arrows step the value by one row (a focus-free value change — no DOM
 * focus moves between rows, which is what makes keyboard nav cheap); the value
 * updates immediately while the row glides to center.
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
 * ends). When looping, we render a runway of inert proxy rows on each side of the
 * real items — the last values before the first row, the first values after the
 * last — as scroll runway (loopBufferCount rows, a couple of viewports, capped at
 * LOOP_BUFFER_MAX, not just visibleCount). On every scroll we fold the center
 * back into the real-items band by whole real-list extents; seamless because a
 * proxy shows the exact value the real row one extent away would. The proxy
 * labels come from a Wheel.Item tracker (see WheelItemTrackerContext), NOT from
 * walking children — children may be wrapped in context providers/fragments.
 *
 * ORIENTATION. Everything above is axis-agnostic: helpers read the main axis via
 * accessors (top/height vs left/width) chosen from `horizontal`, and the CSS has
 * a [data-horizontal] variant.
 */

import { createContext } from "preact";
import { useContext, useId, useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { compareTwoJsValues } from "@jsenv/navi/src/utils/compare_two_js_values.js";
import {
  ControlFacadeChildrenWrapper,
  useControlFacadeProps,
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
    /* NO will-change: transform. translate3d already composites the track for
       the glide/momentum; will-change additionally pins it to its own layer,
       which the glass panes' backdrop-filter then samples with a bright fringe
       (halo) around each glyph, and can shift how the transformed text renders
       vs the (untransformed) separators. */
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
    .navi_loading_outline_wrapper {
      z-index: 3;
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

      .navi_wheel_viewport {
        height: calc(var(--wheel-item-height) * var(--wheel-visible-count));
        -webkit-mask-image: var(--wheel-fade);
        mask-image: var(--wheel-fade);
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
        /* contain-intrinsic-width: auto 3ch; */
        height: var(--wheel-item-height);
        padding-inline: var(--wheel-item-padding-x, 0.5ch);
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
      .navi_loading_outline_wrapper {
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

      .navi_wheel_viewport {
        width: calc(var(--wheel-item-width) * var(--wheel-visible-count));
        -webkit-mask-image: var(--wheel-fade);
        mask-image: var(--wheel-fade);
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
        /* contain-intrinsic-height: auto 1.5em; */
        width: var(--wheel-item-width);
        padding-block: var(--wheel-item-padding-x, 0.5ch);
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
      .navi_loading_outline_wrapper {
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
     keeps its natural content width (small for ":", wide for a word like
     "hours") and is not scrollable. The spacing between a wheel and a separator
     is provided by the wheel: its scrollable viewport is padded by
     --wheel-spacing, so scrolling/dragging in that gap scrolls the wheel — only
     the small separator glyph itself is a dead zone, which keeps the UX good. */
  .navi_wheel_group {
    --wheel-spacing: 0.5ch;

    display: inline-flex;
    align-items: center;

    &:not([data-horizontal]) .navi_wheel_viewport {
      padding-inline: var(--wheel-spacing);
    }
    &[data-horizontal] {
      flex-direction: column;
      align-items: center;

      .navi_wheel_viewport {
        padding-block: var(--wheel-spacing);
      }
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

    /* Rasterize on the same grid as the wheels' transformed (translate3d) track.
       Without a compositing layer of its own, this static glyph is painted in the
       main layer and can land ~1px off from the GPU-composited digits — invisible
       for ":" but obvious for a tall glyph like "ZZ". translateZ(0) promotes it to
       a layer so both go through the same rasterization. */
    transform: translateZ(0);
    user-select: none;

    /* [center]: vertically center the glyph in the row instead of baseline-
       aligning it — glyphs that sit low on the baseline (e.g. ":") then land on
       the numbers' optical center. A full-row line-height does the centering. */
    &[data-center] {
      line-height: var(--wheel-item-height);
    }
  }
`;

// Upper bound on the loop runway rendered on each side. A fling never travels
// this many rows between scroll events, so more would only add invisible DOM.
const LOOP_BUFFER_MAX = 20;

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

// Programmatic glide (arrow keys, clone click). Duration is proportional to the
// distance (constant speed, px/ms) so a redirect to a farther target — e.g. a
// second arrow press before the first glide finishes — lengthens the glide to
// match instead of speeding up: the wheel keeps travelling at a steady, readable
// pace. Bounded so a one-row step is still visible and a long redirect stays
// snappy.
const WHEEL_GLIDE_SPEED = 0.16; // ≈ one row (32px) in 200ms
const WHEEL_GLIDE_MIN_MS = 140;
const WHEEL_GLIDE_MAX_MS = 600;

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
  "bounded",
  "horizontal",
  "glass",
  "frameBorder",
  "glideSpeed",
  "type",
];

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
  const trackedItemsRef = useRef(trackedItems);
  trackedItemsRef.current = trackedItems;
  const loopClones = isLoop
    ? trackedItems.map((item) => ({
        value: item.value,
        label: item.label,
        itemProps: item.itemProps,
      }))
    : [];

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

  // Ask the framework to change the value (respects readonly/disabled and pops
  // the readonly callout for free); the controlled value / action flow then
  // updates uiState, which syncCenterToSelection reacts to.
  const requestSelectValue = (newValue, event) => {
    if (compareTwoJsValues(newValue, currentValueRef.current)) {
      return;
    }
    dispatchRequestSetUIState(inputRef.current, newValue, { event });
  };

  // Gate a user gesture (scroll, drag, tap, arrow) through the framework's
  // interactivity check. When the wheel is readonly/disabled/busy the gate pops
  // the matching callout and runs onPrevented (e.g. to trap the page scroll);
  // otherwise it runs onAllowed. One path covers all three blocked states.
  const attemptInteraction = (event, name, onAllowed, onPrevented) => {
    dispatchRequestInteraction(inputRef.current, {
      event,
      name,
      allowed: onAllowed,
      prevented: onPrevented,
    });
  };

  // Real rows are the tracked items (clones carry .navi_wheel_item_clone). The
  // selection is the wheel's single value, mapped to a row via the tracker.
  const REAL_ITEM_SELECTOR = ".navi_wheel_item:not(.navi_wheel_item_clone)";
  const getItemValueById = (id) => {
    const match = trackedItemsRef.current.find((it) => it.id === id);
    return match ? match.value : undefined;
  };
  const getIdForValue = (value) => {
    const items = trackedItemsRef.current;
    const match = items.find((it) => compareTwoJsValues(it.value, value));
    if (match) {
      return match.id;
    }
    return items.length ? items[0].id : null;
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

  // The id of the item currently sitting in the center. Guards the effects so an
  // external value change (or the initial mount) scrolls the selection into
  // place, while our own scroll-driven selection does not scroll a second time.
  const centeredIdRef = useRef(null);
  // The wheel does NOT use native scroll. `posRef` is our own virtual scroll
  // position (px, main axis); the list track is translated by -pos. This is the
  // single source of truth, wrapped modulo the real-list extent in loop mode, so
  // there is no physical scroll edge to get stuck at. animRef holds the current
  // momentum rAF; glideRef the current CSS-transition glide, either cancellable.
  const posRef = useRef(0);
  const animRef = useRef(null);
  const glideRef = useRef(null);
  // The glide code is bound once (mount effect) but the speed can change live
  // (e.g. a demo control) — read it through a ref so redirects use the latest.
  const glideSpeedRef = useRef(glideSpeed);
  glideSpeedRef.current = glideSpeed;

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

  // Rows are uniform, so one size drives all geometry. content-visibility:auto
  // makes an off-screen row report offsetWidth/Height 0 (its offsetLeft/Top stays
  // correct), so a size read straight off an arbitrary row can be 0 mid-scroll.
  // Take the gap between two adjacent real rows' starts — always reliable — and
  // fall back to a rendered row's measured size, then the CSS variable.
  const getItemSize = (vp) => {
    const reals = vp.querySelectorAll(REAL_ITEM_SELECTOR);
    if (reals.length >= 2) {
      const gap = itemMainStart(reals[1]) - itemMainStart(reals[0]);
      if (gap > 0) {
        return gap;
      }
    }
    if (reals.length >= 1) {
      const size = itemMainSize(reals[0]);
      if (size > 0) {
        return size;
      }
    }
    const anyRow = vp.querySelector(".navi_wheel_item");
    return anyRow ? itemMainSize(anyRow) : 0;
  };

  const getViewport = () => ref.current?.querySelector(".navi_wheel_viewport");
  const getTrack = (vp) => vp.querySelector(".navi_wheel_list");

  const clampNumber = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  const applyTransform = (track, pos) => {
    // Snap to a whole pixel so the digits stay crisp. The separators are promoted
    // to their own compositing layer (see .navi_wheel_group_separator) so they
    // rasterize on the same grid as this transformed track — otherwise GPU-layer
    // text can land ~1px off from main-layer text, which a tall separator glyph
    // (e.g. "ZZ") makes obvious. (The WAAPI glide interpolates its own keyframes,
    // so mid-animation smoothness is unaffected.)
    const p = -Math.round(pos);
    track.style.transform = isHorizontal
      ? `translate3d(${p}px, 0, 0)`
      : `translate3d(0, ${p}px, 0)`;
  };

  // Push the current virtual position onto the track via transform, and refresh
  // the "current" emphasis. Transition is cleared so per-frame momentum/drag
  // updates apply instantly (only glideTo opts into a CSS transition).
  const renderPos = (vp) => {
    const track = getTrack(vp);
    if (track) {
      track.style.transition = "none";
      applyTransform(track, posRef.current);
    }
    updateCurrentMarker(vp, findCenteredRow(vp));
  };

  // Where the running glide currently is, computed from the animation's eased
  // progress between its recorded from/to — NOT getComputedStyle, which on a live
  // compositor animation forces an expensive style+compositor sync (that sync,
  // run once per arrow keypress, is what stalled rapid navigation).
  const getGlidePos = (glide) => {
    const progress = glide.animation.effect.getComputedTiming().progress;
    if (progress === null || progress === undefined) {
      return glide.toPos;
    }
    return glide.fromPos + (glide.toPos - glide.fromPos) * progress;
  };

  const findCenteredMatching = (viewportEl, selector) => {
    const items = viewportEl.querySelectorAll(selector);
    const center = posRef.current + viewportMain(viewportEl) / 2;
    const itemSize = getItemSize(viewportEl);
    let closest = null;
    let closestDistance = Infinity;
    for (const item of items) {
      const itemCenter = itemMainStart(item) + itemSize / 2;
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
    findCenteredMatching(viewportEl, REAL_ITEM_SELECTOR);
  // The "current" emphasis tracks the centered *rendered row* including loop
  // proxies, so a proxy lights up exactly like a real value as it reaches the
  // center — the wrap that swaps it for the real row is then invisible.
  const findCenteredRow = (viewportEl) =>
    findCenteredMatching(viewportEl, ".navi_wheel_item");

  // The virtual position that centers a given row.
  const centerPosFor = (vp, el) =>
    itemMainStart(el) - (viewportMain(vp) - getItemSize(vp)) / 2;

  // Loop: fold the position back into the real-items band [bufferSpan,
  // bufferSpan+realSpan). A real-list extent away shows identical content, so
  // this is invisible — and because it's our own value (not scrollTop) there is
  // no physical edge to get stuck against. Returns true if it moved.
  const wrapPos = (vp) => {
    // Real-item count comes from the DOM, not a closed-over `loopClones`: the
    // input effect binds these helpers once, before Wheel.Item children have
    // registered, so the captured `loopClones` would still be empty here.
    const realItems = vp.querySelectorAll(REAL_ITEM_SELECTOR);
    if (!isLoop || !realItems.length) {
      return false;
    }
    const realSpan = getItemSize(vp) * realItems.length;
    if (realSpan === 0) {
      return false;
    }
    const bufferSpan = itemMainStart(realItems[0]);
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
    const items = vp.querySelectorAll(REAL_ITEM_SELECTOR);
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
    if (glideRef.current !== null) {
      const glide = glideRef.current;
      glideRef.current = null;
      // Freeze where the glide currently is, then render it as a plain transform
      // so subsequent momentum/drag/redirect updates continue from there.
      posRef.current = getGlidePos(glide);
      glide.animation.onfinish = null;
      glide.animation.cancel();
      renderPos(glide.vp);
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
    requestSelectValue(
      getItemValueById(centered.id),
      new CustomEvent("navi_wheel_settle"),
    );
  };

  // Glide the position to a target with the Web Animations API. WAAPI runs the
  // transform on the compositor (smooth even while the arrow-key selection change
  // triggers a main-thread re-render that would starve a rAF loop), and gives a
  // real handle: onfinish tells us exactly when it's done, and cancelAnim can
  // read the live value + cancel it to redirect a fresh glide (rapid arrow
  // presses). The transform is set *raw* (no wrap) so it can travel onto a clone;
  // onDone normalises + selects.
  const glideTransform = (pos) => {
    const p = -pos;
    return isHorizontal
      ? `translate3d(${p}px, 0, 0)`
      : `translate3d(0, ${p}px, 0)`;
  };
  const animateTo = (vp, target, onDone) => {
    // A redirect mid-glide (e.g. a second arrow press) continues at the same
    // constant speed with linear easing, so rapid presses read as steady motion
    // rather than a re-accelerating jump each time. A glide from rest eases out.
    const redirecting = glideRef.current !== null;
    const fromPos = redirecting
      ? getGlidePos(glideRef.current)
      : posRef.current;
    cancelAnim();
    const track = getTrack(vp);
    const dist = target - fromPos;
    if (!track || Math.abs(dist) < 0.5) {
      posRef.current = target;
      renderPos(vp);
      onDone();
      return;
    }
    // Constant speed (px/ms) → duration proportional to distance. On a redirect
    // (a second arrow/tap before the glide finished) the target is farther, so
    // cap the duration at roughly one row's travel time: the wheel then covers
    // however many rows it is behind within that window, i.e. it speeds up the
    // more you're behind. This keeps rapid presses feeling tied to how fast you
    // press instead of stretching into one long, detached smooth glide. A glide
    // from rest keeps the full range so a single step eases out naturally.
    const speed = glideSpeedRef.current;
    const rowMs = getItemSize(vp) / speed;
    const maxMs = redirecting
      ? clampNumber(rowMs, WHEEL_GLIDE_MIN_MS, WHEEL_GLIDE_MAX_MS)
      : WHEEL_GLIDE_MAX_MS;
    const duration = clampNumber(
      Math.abs(dist) / speed,
      WHEEL_GLIDE_MIN_MS,
      maxMs,
    );
    posRef.current = target;
    const animation = track.animate(
      [
        { transform: glideTransform(fromPos) },
        { transform: glideTransform(target) },
      ],
      {
        duration,
        easing: redirecting ? "linear" : "cubic-bezier(0.22, 0.61, 0.36, 1)",
        fill: "forwards",
      },
    );
    updateCurrentMarker(vp, findCenteredRow(vp));
    animation.onfinish = () => {
      glideRef.current = null;
      // Commit the end transform to inline style, then drop the animation so it
      // doesn't keep the property pinned.
      applyTransform(track, target);
      animation.cancel();
      onDone();
    };
    glideRef.current = { vp, animation, fromPos, toPos: target };
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
        v *= Math.pow(WHEEL_DECAY, dt / 16);
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
      setPos(vp, posRef.current + dist * WHEEL_SPRING_FACTOR);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  };

  // Center a specific item (external value / initial / keyboard). Smooth picks
  // the nearest copy so arrowing off an end glides one step onto a clone.
  const centerOn = (vp, itemEl, behavior) => {
    const base = centerPosFor(vp, itemEl);
    let target = base;
    const realCount = vp.querySelectorAll(REAL_ITEM_SELECTOR).length;
    if (isLoop && realCount && behavior === "smooth") {
      const realSpan = getItemSize(vp) * realCount;
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
  const handleCloneClick = (index, event) => {
    const vp = getViewport();
    if (!vp) {
      return;
    }
    const target = vp.querySelectorAll(REAL_ITEM_SELECTOR)[index];
    if (!target) {
      return;
    }
    attemptInteraction(event, "select", () => {
      centeredIdRef.current = target.id;
      requestSelectValue(getItemValueById(target.id), event);
      centerOn(vp, target, "smooth");
    });
  };

  // The row for the current value (the selection), else the first row.
  const getSelectedItem = (viewportEl) => {
    const id = getIdForValue(currentValueRef.current);
    const byId = id ? viewportEl.querySelector(`#${CSS.escape(id)}`) : null;
    return byId || viewportEl.querySelector(REAL_ITEM_SELECTOR);
  };

  // Sync the center with the current value — used on first display and whenever
  // the controlled value changes from outside.
  const syncCenterToSelection = (viewportEl, behavior) => {
    // A glide or momentum in flight (tap, arrow, fling) is already taking the
    // wheel to the right row. This runs on every controlled-value re-render, which
    // lags a frame behind our own centeredIdRef — so on rapid taps its guard below
    // would miss and it would snap instantly mid-glide, leaving the wheel stuck
    // off-center. Let the motion finish: commitSelection settles the value and the
    // next render is a no-op. A genuine external change made during motion is
    // honoured once it settles (centeredIdRef then differs from the selection).
    if (glideRef.current !== null || animRef.current !== null) {
      return;
    }
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
        centeredIdRef.current = null;
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

  // Input: wheel + pointer drag drive the virtual position; a short idle after
  // wheel, or the end of a drag's momentum, snaps to the nearest value. When the
  // wheel is readonly/disabled/busy the interaction gate (attemptInteraction)
  // shows the matching callout instead of moving, and traps the page scroll.
  useLayoutEffect(() => {
    const el = ref.current;
    const vp = el.querySelector(".navi_wheel_viewport");
    let settleTimer = null;

    const scheduleSettle = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => settle(vp, 0), 90);
    };
    // Non-loop only: is a wheel in this direction blocked (so the page should
    // scroll instead of the wheel trapping it)?
    const atClampedEnd = (delta) => {
      if (isLoop) {
        return false;
      }
      const items = vp.querySelectorAll(REAL_ITEM_SELECTOR);
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
      attemptInteraction(
        e,
        "scroll",
        () => {
          if (atClampedEnd(delta)) {
            return; // let the page scroll past a non-looping end
          }
          e.preventDefault();
          cancelAnim();
          setPos(vp, posRef.current + delta);
          scheduleSettle();
        },
        () => {
          // Blocked (readonly/disabled/busy): the gate showed the callout; trap
          // the scroll so the page doesn't move under the control the user is
          // trying to use.
          e.preventDefault();
        },
      );
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
      attemptInteraction(e, "scroll", () => {
        cancelAnim();
        // Fold the (possibly accumulated) position back into the real-items band
        // first — seamless, since a whole extent away shows identical content — so
        // repeated ±item never walks the glide off the end of the clone runway
        // into blank space (which also desynced the centered value).
        if (isLoop) {
          wrapPos(vp);
        }
        if (e.detail.behavior === "smooth") {
          animateTo(vp, posRef.current + delta, () => settle(vp, 0));
        } else {
          setPos(vp, posRef.current + delta);
          scheduleSettle();
        }
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
      attemptInteraction(e, "select", () => {
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
        // A tap: glide the tapped neighbour to center and select it. The centered
        // row is a no-op; clones keep their own handler (handleCloneClick).
        const tapped = e.target.closest(REAL_ITEM_SELECTOR);
        if (tapped && tapped.id !== centeredIdRef.current) {
          centeredIdRef.current = tapped.id;
          updateCurrentMarker(vp, tapped);
          requestSelectValue(getItemValueById(tapped.id), e);
          centerOn(vp, tapped, "smooth");
        } else {
          // Tapped the already-centered row (common when spam-clicking one spot):
          // the pointerdown froze any in-flight glide at a fractional position, so
          // snap cleanly to the nearest row instead of resting off-center.
          settle(vp, 0);
        }
        return;
      }
      // Position moves opposite to the finger.
      settle(vp, -velocity);
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    vp.addEventListener("pointerdown", onPointerDown);
    vp.addEventListener("pointermove", onPointerMove);
    vp.addEventListener("pointerup", onPointerUp);
    vp.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("navi_scroll", onNaviScroll);
    return () => {
      clearTimeout(settleTimer);
      cancelAnim();
      vp.removeEventListener("wheel", onWheel);
      vp.removeEventListener("pointerdown", onPointerDown);
      vp.removeEventListener("pointermove", onPointerMove);
      vp.removeEventListener("pointerup", onPointerUp);
      vp.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("navi_scroll", onNaviScroll);
    };
  }, [isLoop, isHorizontal, interactive]);

  // Keyboard: the spinbutton container is the single focusable element. The
  // main-axis arrows step the value by one row (a fast, focus-free value change,
  // unlike a radio group that moves DOM focus per step); the value updates
  // immediately (for AT) while the row glides to center. Cross-axis arrows are
  // left for the WheelGroup to move focus between wheels.
  useLayoutEffect(() => {
    const el = ref.current;
    const vp = el.querySelector(".navi_wheel_viewport");
    const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
    const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";
    const stepKeys = new Set([prevKey, nextKey, "Home", "End"]);
    const onKeyDown = (e) => {
      if (!stepKeys.has(e.key)) {
        return;
      }
      e.preventDefault();
      // A blocked wheel (readonly is focusable, so arrows can reach it) pops the
      // matching callout instead of stepping.
      attemptInteraction(e, "step", () => {
        const reals = [...vp.querySelectorAll(REAL_ITEM_SELECTOR)];
        if (!reals.length) {
          return;
        }
        // The centered row is the source of truth for "where we are now": a ref,
        // so rapid presses step from the latest position (the closure's
        // currentValue would be a render behind). Fall back to the selection,
        // then the first row.
        const centeredId = centeredIdRef.current;
        let selectedIndex = centeredId
          ? reals.findIndex((row) => row.id === centeredId)
          : -1;
        if (selectedIndex < 0) {
          selectedIndex = reals.indexOf(getSelectedItem(vp));
        }
        if (selectedIndex < 0) {
          selectedIndex = 0;
        }
        let nextIndex;
        if (e.key === "Home") {
          nextIndex = 0;
        } else if (e.key === "End") {
          nextIndex = reals.length - 1;
        } else {
          nextIndex = selectedIndex + (e.key === nextKey ? 1 : -1);
          if (isLoop) {
            nextIndex =
              ((nextIndex % reals.length) + reals.length) % reals.length;
          } else {
            nextIndex = clampNumber(nextIndex, 0, reals.length - 1);
          }
        }
        const targetItem = reals[nextIndex];
        centeredIdRef.current = targetItem.id;
        updateCurrentMarker(vp, targetItem);
        requestSelectValue(getItemValueById(targetItem.id), e);
        centerOn(vp, targetItem, "smooth");
      });
    };
    el.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("keydown", onKeyDown);
    };
  }, [isHorizontal, interactive, isLoop]);

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
        // eslint-disable-next-line react/no-children-prop
        children={undefined}
      />
      <LoadingOutline
        loading={loading}
        color="var(--navi-loader-color)"
        inset={-1}
      />
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
            <ControlFacadeChildrenWrapper facadeController={facadeController}>
              {children}
            </ControlFacadeChildrenWrapper>
          </WheelItemTrackerContext.Provider>
          {isLoop
            ? renderClones(
                getLoopBufferItems(loopClones, loopBufferCount, "after"),
                "after",
                handleCloneClick,
              )
            : null}
        </ul>
        <div className="navi_wheel_pane" data-side="start" />
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
    items.push({
      label: clones[index].label,
      itemProps: clones[index].itemProps,
      index,
    });
  }
  return items;
};

// Inert visual proxies of the real items used for seamless looping. They are
// hidden from assistive tech, copy the real row's styling (itemProps) so widths
// match, and clicking one selects the real item it stands in for (handleCloneClick).
const renderClones = (bufferItems, position, onCloneClick) => {
  return bufferItems.map((item, offset) => (
    <Box
      as="li"
      key={`${position}_${offset}`}
      {...item.itemProps}
      baseClassName="navi_wheel_item navi_wheel_item_clone"
      aria-hidden="true"
      onClick={(e) => {
        if (e.button !== 0) {
          return;
        }
        onCloneClick(item.index, e);
      }}
    >
      {item.label}
    </Box>
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

/**
 * Wheel.Item — a value in a Wheel. Must be used inside <Wheel>.
 *
 * The item is an inert, aria-hidden row (a Box, so it can be styled): the wheel's
 * spinbutton container owns focus and announces the value, so an item's only job
 * is to register its {value, label} with the wheel and be clickable to center
 * itself. Selection lives on the wheel's value, not per item. Any extra props
 * (style, padding, className…) are applied here AND mirrored onto the loop
 * proxies so a real row and its proxy stay dimensionally identical.
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

  // Report this item's value + label to the wheel (used to build loop proxies
  // and to map a value back to its row). Wheel.Item must live inside a Wheel, so
  // the context is always present. itemProps rides along so the clones can copy
  // this row's styling.
  const trackerContext = useContext(WheelItemTrackerContext);
  const index = trackerContext.indexRef.current++;
  trackerContext.tracker.useTrackItem({
    id: resolvedId,
    index,
    value,
    label: children,
    itemProps: rest,
  });

  return (
    <Box
      as="li"
      {...rest}
      id={resolvedId}
      baseClassName="navi_wheel_item"
      aria-hidden="true"
    >
      {children}
    </Box>
  );
};
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
 * @param {boolean} [props.frameBorder] - Line every wheel's center-window edges with a faint frame (off by default; independent of glass).
 */
export const WheelGroup = ({
  spacing,
  horizontal,
  glass,
  frameBorder,
  style,
  children,
  ...rest
}) => {
  import.meta.css = css;
  const groupRef = useRef(null);
  const groupStyle = {
    ...(spacing === undefined
      ? {}
      : {
          "--wheel-spacing":
            typeof spacing === "number" ? `${spacing}px` : spacing,
        }),
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
      {...rest}
      ref={groupRef}
      baseClassName="navi_wheel_group"
      data-horizontal={horizontal ? "" : undefined}
      style={groupStyle}
    >
      <WheelGroupContext.Provider value={{ glass, frameBorder, horizontal }}>
        {children}
      </WheelGroupContext.Provider>
    </Box>
  );
};
/**
 * WheelGroup.Separator — content shown between wheels (":", a word, an icon…).
 * Its content sits in a one-row box that mirrors a wheel item, so by default it
 * shares the numbers' text baseline (right for words / letters like "ZZ").
 *
 * @param {object} props
 * @param {boolean} [props.center] - Vertically center the glyph in the row
 *   instead of baseline-aligning it. Use for glyphs that sit low on the baseline
 *   (e.g. ":") so they land on the numbers' optical center.
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
