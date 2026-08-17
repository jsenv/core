/**
 * What a press can turn out to be: a swipe, or a hold.
 *
 * One detector for both, because they dispute the SAME press and something has to
 * arbitrate them in one place — read apart, a hold that drifts three pixels both
 * opens the menu and starts putting the row away. A finger lands; it leaves
 * sideways (a swipe), it stays still (a hold), it lifts at once (a click, which is
 * not this detector's business).
 *
 * Naming the interactions in `interactions` rather than letting one callback read
 * the pointer is what lets this know, BEFORE the first pixel, which of them the
 * element takes. Two things depend on knowing that early:
 *
 * - **The arbitration between nested boxes.** A row swiped sideways lives inside a
 *   container that travels sideways too, and the innermost box must take the axis
 *   it walks — read from the DOM at the press, and only from there (see axesLeftBy
 *   in @jsenv/dom). The axis comes from the name (`swipe_left` and `swipe_right`
 *   say `x`), so the attribute is written at render time. Written during the
 *   gesture it would arrive too late: a browser decides what a touch may do when
 *   the touch BEGINS. Same for `touch-action` and iOS's callout below, which is
 *   why they are a stylesheet and not a line of JS in the pointerdown.
 *
 * - **The click a gesture leaves behind.** A hold ends with a `pointerup`, so the
 *   browser follows it with a `click` on whatever the finger was over — a link,
 *   and the page navigates as well as opening the menu.
 *
 * A swipe makes the element follow the finger — there is nothing to decide about
 * that — and says where it is up to, for the caller to draw the rest with:
 *
 * - `--swipe-pulled`: how far it has come, signed, in px.
 * - `--swipe-progress`: the same as a fraction of the element, signed. Inherited,
 *   so anything inside the element can read it.
 * - `[data-swiping="left|right|up|down"]`: which way, while a finger holds it.
 * - `[data-swipe-past-threshold]`: letting go now would go through with it.
 *
 * WHAT is revealed behind is the caller's: navi does not know what putting a row
 * away looks like. A trail is usually a child of the swiped element sized off
 * `--swipe-pulled`, which is what makes those values reachable from CSS at all — a
 * sibling could not read them.
 *
 * A swipe is its own gesture, not the drag-to-travel of a slide container: it
 * borrows the same reader (`startDragToTravel`, whose axis lock, resistance, flick
 * and click-swallowing are exactly what a swipe needs) with its own settings, and
 * it is those settings that differ — a third of a row rather than a third of a
 * screen, tuned per element with `data-swipe-threshold`.
 *
 * What is deliberately NOT here: `longpress` opening a popup while the finger is
 * still down. The `pointerup` that ends the press is then an interaction OUTSIDE
 * the popup, and the browser's own light dismiss closes it on the spot — decided
 * from the recorded pointerdown, not something a gesture can take back. Opening on
 * release is what works meanwhile.
 */

import {
  startDragToTravel,
  suppressClickAfterGesture,
  waitForPressHeld,
} from "@jsenv/dom";

import { defineInteractionDetector } from "./interaction_registry.js";

// The axis each swipe names, which is the whole reason they are named rather than
// counted: an element that takes a horizontal swipe has to say so in the DOM
// before it is touched.
const AXIS_BY_SWIPE_TYPE = {
  swipe_left: "x",
  swipe_right: "x",
  swipe_up: "y",
  swipe_down: "y",
};
// Which way the content goes. A drag towards positive x moves the row right, which
// is a swipe right — and, for the travel underneath, the direction that brings in
// what comes BEFORE (`travelBack`).
const SWIPE_TYPE_BY_AXIS = {
  x: { positive: "swipe_right", negative: "swipe_left" },
  y: { positive: "swipe_down", negative: "swipe_up" },
};

// How much of the element has to be pulled for letting go to go through with it. A
// FRACTION and never a distance: the same gesture must mean the same thing on a
// phone and on a wide screen. Speed answers on its own on top of this — a brief
// flick counts whatever the distance covered.
const SWIPE_THRESHOLD_DEFAULT = 0.33;
// Under the system context-menu delay, so the press is answered before the menu it
// would otherwise open.
const LONGPRESS_DELAY_DEFAULT = 450;
// Past this the finger is going somewhere: it swipes, it does not hold.
const LONGPRESS_SLOP_DEFAULT = 8;
// How long the element takes to reach where the gesture leaves it, or to come
// back. Written into the CSS below from here: the state is cleaned up when the
// movement is over, so a duration living only in the stylesheet would be a timing
// JS has to know and cannot read reliably.
const SETTLE_DURATION_MS = 200;

// Read off the element or off any ancestor carrying it, so a whole list is tuned
// in one place and a stylesheet can read the same value.
const SWIPE_THRESHOLD_ATTRIBUTE = "data-swipe-threshold";
const LONGPRESS_DELAY_ATTRIBUTE = "data-longpress-delay";
const LONGPRESS_SLOP_ATTRIBUTE = "data-longpress-slop";

// Which axes this element takes a swipe on, and that it takes a hold: said in the
// DOM at render time, for the CSS below and for the boxes above to read.
const SWIPE_AXES_ATTRIBUTE = "data-swipe";
const LONGPRESS_ATTRIBUTE = "data-longpress";

import.meta.css = /* css */ `
  /* Declared, so the browser sees a NUMBER it can interpolate and calculate with:
     what a swipe reveals behind the element is drawn from this, and an undeclared
     custom property only ever jumps from one value to the next. Inherited, so
     anything inside the element can read it. */
  @property --swipe-progress {
    syntax: "<number>";
    inherits: true;
    initial-value: 0;
  }
  @property --swipe-pulled {
    syntax: "<length>";
    inherits: false;
    initial-value: 0px;
  }

  /* What a touch may do on an element that takes a swipe: the axis the swipe walks
     is taken, the other is left to the page — so a row is swiped sideways and the
     list still scrolls under the same finger. */
  [${SWIPE_AXES_ATTRIBUTE}="x"] {
    touch-action: pan-y;
  }
  [${SWIPE_AXES_ATTRIBUTE}="y"] {
    touch-action: pan-x;
  }
  [${SWIPE_AXES_ATTRIBUTE}="xy"] {
    touch-action: none;
  }

  /* iOS shows its callout (Copy / Look Up) and selects the word under the finger on
     a press held still, and does not always route that through an event that can be
     refused. Same reason as the drag sources in @jsenv/dom: it has to be true
     before the finger lands. */
  [${LONGPRESS_ATTRIBUTE}] {
    -webkit-touch-callout: none;
  }

  /* The element follows the finger. The translate property rather than a transform,
     so whatever transform the element (or its theme) already has is left alone. */
  [data-swiping] {
    user-select: none;
  }
  [data-swiping="left"],
  [data-swiping="right"] {
    translate: var(--swipe-pulled) 0;
  }
  [data-swiping="up"],
  [data-swiping="down"] {
    translate: 0 var(--swipe-pulled);
  }
  /* No transition while the finger holds it — the element is where the hand put
     it — and one when the hand lets go. */
  [data-swipe-settling] {
    transition: translate ${SETTLE_DURATION_MS}ms ease-out;
  }
`;

defineInteractionDetector({
  name: "press",
  claims: (type) => type in AXIS_BY_SWIPE_TYPE || type === "longpress",
  // A hold nobody can see and nobody can reach from a keyboard is a dead end, so
  // the way in is a default rather than an option: the "menu" key and a right
  // click are the same request as a press held still.
  //
  // Which means a right click answers the hold instead of opening the browser's
  // menu, and that is the point rather than a side effect: an element that
  // answers a hold has its own answer to give, and the browser's menu on top of
  // it would be the wrong one. An element that declares no hold is left alone.
  // `contextmenu: false` refuses the implication for the rare case that wants the
  // browser's menu anyway.
  implies: (claimedTypes, interactions) => {
    if (!claimedTypes.includes("longpress")) {
      return null;
    }
    return { contextmenu: interactions.longpress };
  },
  setup: ({ types, ref, request, readConfig }) => {
    let axes = "";
    for (const type of types) {
      const axis = AXIS_BY_SWIPE_TYPE[type];
      if (axis && !axes.includes(axis)) {
        axes += axis;
      }
    }
    const hasLongPress = types.includes("longpress");

    const onPointerDown = (pointerDownEvent) => {
      const element = ref.current;
      if (!element || pointerDownEvent.button !== 0) {
        return;
      }
      let swipe = null;
      let press = null;

      if (axes) {
        swipe = startSwipe(pointerDownEvent, {
          element,
          axes,
          types,
          request,
          threshold: readConfig(
            SWIPE_THRESHOLD_ATTRIBUTE,
            SWIPE_THRESHOLD_DEFAULT,
          ),
          // The axis is the definitive word on what this press is: a finger that
          // has picked one is swiping, not holding. The slop below cancels most
          // holds before this (it is the smaller distance), but a press that
          // resolves the axis without drifting — a mouse, a flick — has to be
          // taken from the wait too.
          onSwipeStart: () => {
            press?.cancel();
            press = null;
          },
        });
      }
      if (hasLongPress) {
        press = waitForPressHeld(pointerDownEvent, {
          delay: readConfig(LONGPRESS_DELAY_ATTRIBUTE, LONGPRESS_DELAY_DEFAULT),
          slop: readConfig(LONGPRESS_SLOP_ATTRIBUTE, LONGPRESS_SLOP_DEFAULT),
          onPressHeld: (pressEvent, { endPress }) => {
            // The hold won the arbitration: the swipe never got the distance it
            // needed, and must not get it from whatever the finger does next.
            swipe?.stop();
            swipe = null;
            const clickSuppressionIsOver = suppressClickAfterGesture();
            const onPointerEnd = () => {
              window.removeEventListener("pointerup", onPointerEnd, true);
              window.removeEventListener("pointercancel", onPointerEnd, true);
              endPress();
              clickSuppressionIsOver();
            };
            window.addEventListener("pointerup", onPointerEnd, true);
            window.addEventListener("pointercancel", onPointerEnd, true);
            request(
              "longpress",
              { pointerType: pressEvent.pointerType },
              pressEvent,
            );
          },
        });
      }
    };

    const props = { onPointerDown };
    if (axes) {
      props[SWIPE_AXES_ATTRIBUTE] = axes;
      // Read by the boxes ABOVE this one: an axis swiped here is not theirs to
      // travel (see axesLeftBy).
      props["data-travel-by-drag"] = axes;
      // …and nothing inside hands its leftover scroll to the page while the
      // element is being pulled.
      props["data-drag-travel"] = axes;

      // A link and an image are draggable without anyone asking, and a native
      // drag IS press-and-move: the browser claims the gesture, takes the
      // pointer events with it and paints a ghost of the row the hand is trying
      // to swipe. Two things are needed, and neither covers the other:
      // - `draggable` refuses it on the element itself, before it starts;
      // - a swipe is usually a row with a link or a thumbnail INSIDE it, and
      //   those are draggable in their own right. `dragstart` bubbles, so
      //   refusing it here refuses theirs too — and it is the only refusal every
      //   browser honours (`-webkit-user-drag` is one engine's).
      // The cost is stated rather than worked around: an element that takes a
      // swipe cannot also be dragged out of the page, because there is one
      // gesture and it cannot mean both.
      props.draggable = false;
      props.onDragStart = (dragStartEvent) => {
        dragStartEvent.preventDefault();
      };
    }
    if (hasLongPress) {
      props[LONGPRESS_ATTRIBUTE] = "";
    }
    return props;
  },
});

const startSwipe = (
  pointerDownEvent,
  { element, axes, types, request, threshold, onSwipeStart },
) => {
  let settleTimeout = null;
  const paint = ({ pulled, progress, type }) => {
    element.style.setProperty("--swipe-pulled", `${pulled}px`);
    element.style.setProperty("--swipe-progress", progress);
    element.setAttribute("data-swiping", type.slice("swipe_".length));
    element.toggleAttribute(
      "data-swipe-past-threshold",
      Math.abs(progress) >= threshold,
    );
  };
  const forget = () => {
    clearTimeout(settleTimeout);
    element.removeAttribute("data-swiping");
    element.removeAttribute("data-swipe-past-threshold");
    element.removeAttribute("data-swipe-settling");
    element.style.removeProperty("--swipe-pulled");
    element.style.removeProperty("--swipe-progress");
  };
  // Where the gesture leaves the element, and later back to rest. Cleaned up on a
  // timeout rather than on transitionend: a swipe let go of at the very edge has
  // nothing left to move (the pull is clamped to the element's size), and a
  // movement that does not happen reports no end.
  const settleTo = ({ pulled, progress, type }, { thenForget = true } = {}) => {
    clearTimeout(settleTimeout);
    element.setAttribute("data-swipe-settling", "");
    paint({ pulled, progress, type });
    if (thenForget) {
      settleTimeout = setTimeout(forget, SETTLE_DURATION_MS);
    }
  };

  return startDragToTravel(pointerDownEvent, {
    element,
    axes,
    commitRatio: threshold,
    onStart: ({ axis }) => {
      const { positive, negative } = SWIPE_TYPE_BY_AXIS[axis];
      const hasPositive = types.includes(positive);
      const hasNegative = types.includes(negative);
      if (!hasPositive && !hasNegative) {
        return false;
      }
      const { width, height } = element.getBoundingClientRect();
      const size = axis === "x" ? width : height;
      if (!size) {
        return false;
      }
      onSwipeStart();
      clearTimeout(settleTimeout);
      element.removeAttribute("data-swipe-settling");
      // A side nothing is declared for is not refused, it resists: the gesture is
      // answered (something moves) while saying there is nothing that way.
      return { size, travelBack: hasPositive, travelOn: hasNegative };
    },
    onPull: ({ axis, pulled, progress }) => {
      paint({ pulled, progress, type: swipeTypeOf(axis, pulled) });
    },
    onEnd: ({ axis, pulled, size, sign, travels, event }) => {
      const type = swipeTypeOf(axis, pulled);
      const restingPlace = { pulled: 0, progress: 0, type };
      if (!travels) {
        settleTo(restingPlace);
        return;
      }
      // Out, and out is where it stays for as long as the answer takes: a row that
      // comes back and leaves again says the gesture was not understood.
      settleTo(
        { pulled: sign * size, progress: sign, type },
        { thenForget: false },
      );
      const pending = request(
        type,
        { axis, sign, pulled, size, progress: pulled / size },
        event,
      );
      if (!pending) {
        settleTo(restingPlace);
        return;
      }
      // However it ended, the element comes back: a failure leaves the row in
      // place and it can be tried again, and a success is the caller's to answer
      // (a list that redemands its rows, a row that leaves). Nothing here makes it
      // disappear — navi does not know what "put away" means.
      const comeBack = () => {
        settleTo(restingPlace);
      };
      pending.then(comeBack, comeBack);
    },
    // Nothing to put back: onGiveUp only ever comes from a press that never became
    // a swipe, so nothing was painted by it.
    onGiveUp: () => {},
  });
};

const swipeTypeOf = (axis, pulled) => {
  const { positive, negative } = SWIPE_TYPE_BY_AXIS[axis];
  return pulled > 0 ? positive : negative;
};
