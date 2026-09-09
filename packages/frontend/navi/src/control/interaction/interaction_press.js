/**
 * What a press can turn out to be: a swipe, a hold, or one of two taps.
 *
 * One detector for all of them, because they dispute the SAME press and something
 * has to arbitrate them in one place — read apart, a hold that drifts three pixels
 * both opens the menu and starts putting the row away. A finger lands; it leaves
 * sideways (a swipe), it stays still (a hold), it lifts at once and comes back (a
 * double click), it lifts at once and stays away (a single click).
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
 * - `--swipe-progress`: the same as a fraction of the element, signed.
 *
 * Both inherit, so anything inside the element can read them.
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
 * A hold does NOT take the context menu with it. Declaring one says what a held
 * FINGER does — a finger held down being the system's own context-menu gesture,
 * which is why that one is refused for the length of the press (see
 * waitForPressHeld). A
 * right click is not that press: it comes from the other button and it is the
 * user asking for the browser's menu, so it keeps opening it. An element that
 * wants the right click to do what the hold does says so, with `contextmenu`
 * beside it.
 *
 * It DOES take the selection, and so does a swipe: nothing under either is text
 * to select, because the browser answers that same press by selecting the word
 * under the thumb and leaves it selected once its menu is gone. What never
 * answered the press keeps its text — a field, a popover, a dialog (see the
 * stylesheet below).
 *
 * A hold CAN open a popup while the finger is still down — a menu appearing under
 * a waiting finger, which is the native gesture. navi's Popover is `popover="manual"`
 * and owns its own dismissal, so the `pointerup` that ends the press is not read as
 * an interaction outside it (the browser's light dismiss, which would close it on
 * that very event, only applies to `popover="auto"`).
 *
 * A DOUBLE CLICK IS COUNTED FROM THE POINTER, which is the whole reason it is here
 * rather than in interaction_native.js beside the browser's own events. At the
 * finger there is no `dblclick`, and there is no second `click` either: two taps
 * in the same place are a gesture the browser keeps for itself (its own zoom), so
 * it withholds them. Counting presses is the only reading that means the same
 * thing under a finger and under a mouse — one name, `double_click`, for what a
 * hand does twice, whichever hand it is.
 *
 * The rhythm is ONE window, opened by the first press and lasting
 * `data-double-click-delay`: the second press has to land inside it, and within
 * `data-double-click-slop` of the first. So a press slow enough to be a hold
 * cannot start a double click, and a hold answered on the second press takes it
 * back — the two dispute that press and the hold, being the later answer, is the
 * one that has to say so.
 *
 * `single_click` is the same window read the other way: the tap that STAYED alone,
 * said once the window has closed on it. It is what an element declares when its
 * two answers are exclusive — a plan opening on the double must not also do
 * whatever a lone tap does on the way there — and it costs that wait, which is why
 * it is a name a caller picks rather than something a declared `double_click`
 * imposes on `click`. Declaring it hands the element's click over: the click each
 * tap leaves behind is swallowed, and `single_click` is what says it happened, so
 * a control wanting its action on a lone click asks for it there
 * (`single_click: "request_action"`). A click no press made — a keyboard
 * activation — is not held: nothing can double it.
 *
 * Neither has a keyboard equivalent, since there is no key meaning "twice". An
 * element only reachable that way needs something else offering the same thing: a
 * `"keyboard:…"` shortcut, a `contextmenu`, the control's own action.
 */

import {
  isPressDrivenClick,
  keepTouchRefusable,
  startDragToTravel,
  suppressClickAfterGesture,
  waitForPressHeld,
  waitForTap,
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
// The window a double click is counted in, opened by the FIRST press. Under the
// hold's delay on purpose: a pause longer than the wait navi calls "held" is
// longer than one gesture.
const DOUBLE_CLICK_DELAY_DEFAULT = 400;
// How far apart the two presses may be, and how far either of them may travel
// before it is a gesture rather than a tap. A fingertip and not a pixel: between
// the two the finger leaves the glass and lands again where it means to, which is
// a wider question than the hold's slop above (has this finger stood still?).
const DOUBLE_CLICK_SLOP_DEFAULT = 30;
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
const DOUBLE_CLICK_DELAY_ATTRIBUTE = "data-double-click-delay";
const DOUBLE_CLICK_SLOP_ATTRIBUTE = "data-double-click-slop";

// Which axes this element takes a swipe on, and that it takes a hold or counts
// taps: said in the DOM at render time, for the CSS below and for the boxes above
// to read.
const SWIPE_AXES_ATTRIBUTE = "data-swipe";
export const LONGPRESS_ATTRIBUTE = "data-longpress";
const DOUBLE_CLICK_ATTRIBUTE = "data-double-click";

const LONGPRESS = "longpress";
const DOUBLE_CLICK = "double_click";
const SINGLE_CLICK = "single_click";

import.meta.css = /* css */ `
  /* Declared, so the browser sees a NUMBER it can interpolate and calculate with:
     what a swipe reveals behind the element is drawn from this, and an undeclared
     custom property only ever jumps from one value to the next. Both inherited,
     because what is drawn from them is drawn by a CHILD of the swiped element:
     the trail behind a row is inside the row, and a value that stopped at the
     element itself would reach 0 exactly where it is read. */
  @property --swipe-progress {
    syntax: "<number>";
    inherits: true;
    initial-value: 0;
  }
  @property --swipe-pulled {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }

  /* What a touch may do on an element that takes a swipe: the axis the swipe walks
     is taken, the other is left to the page — so a row is swiped sideways and the
     list still scrolls under the same finger. */
  [data-swipe="x"] {
    touch-action: pan-y;
  }
  [data-swipe="y"] {
    touch-action: pan-x;
  }
  [data-swipe="xy"] {
    touch-action: none;
  }

  /* Two taps in the same place are the browser's own zoom gesture, and a browser
     holding one back holds the click back with it. Taking that gesture is also
     what removes the delay a click is kept for while the browser waits to see a
     second tap. At zero specificity, so anything else saying what a touch may do
     here wins: the swipe above, a pan-zoom surface in its own stylesheet. */
  :where([data-double-click]) {
    touch-action: manipulation;
  }

  /* iOS shows its callout (Copy / Look Up) and selects the word under the finger on
     a press held still, and does not always route that through an event that can be
     refused. Same reason as the drag sources in @jsenv/dom: it has to be true
     before the finger lands. */
  [data-longpress] {
    -webkit-touch-callout: none;
  }

  /* And nothing under any of these gestures is text to select. Each answers the
     press itself — what a finger held still means, what a finger leaving sideways
     means, what a hand doing it twice means — while the browser answers that same
     press with a selection of its own: the word under the thumb, blue, with
     handles, still there once the press is over, and under a mouse the word a
     double click lands on. The callout above is the iOS half of it; this is what
     the other engines make of the same press, said to a mouse too, which cannot
     finish a selection begun where the press is a gesture.
     Prefixed too: Safari only took the property unprefixed at 17. */
  [data-longpress],
  [data-swipe],
  [data-double-click] {
    user-select: none;
    -webkit-user-select: none;
  }
  /* Except what never answered that press: something saying its press is its own
     business, a layer OVER the element, and a field, whose caret is placed by
     dragging through its text — a door that only looks like one has no text of its
     own to place a caret in. The same list, read for the same reason, as the drag
     sources in @jsenv/dom (see DRAG_IGNORED_SELECTOR in drag_to.js).
     Given as text and not as auto: auto computes to none under a parent that is
     none, so it would give back nothing. */
  :is([data-longpress], [data-swipe], [data-double-click])
    :is([data-drag-ignore], [popover], dialog),
  :is([data-longpress], [data-swipe], [data-double-click])
    :is(input:not([data-press-only]), textarea),
  :is([data-longpress], [data-swipe], [data-double-click])
    :is([contenteditable=""], [contenteditable="true"]) {
    user-select: text;
    -webkit-user-select: text;
  }

  /* The element follows the finger. The translate property rather than a transform,
     so whatever transform the element (or its theme) already has is left alone. */
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
  claims: (type) =>
    type in AXIS_BY_SWIPE_TYPE ||
    type === LONGPRESS ||
    type === DOUBLE_CLICK ||
    type === SINGLE_CLICK,
  // Every one of them is "what this press turns out to be": until it turns out,
  // the press is theirs.
  disputesPress: true,
  setup: (element, trigger, { types, readConfig }) => {
    let axes = "";
    for (const type of types) {
      const axis = AXIS_BY_SWIPE_TYPE[type];
      if (axis && !axes.includes(axis)) {
        axes += axis;
      }
    }
    const hasLongPress = types.includes(LONGPRESS);
    const hasDoubleClick = types.includes(DOUBLE_CLICK);
    const hasSingleClick = types.includes(SINGLE_CLICK);
    const countsTaps = hasDoubleClick || hasSingleClick;
    if (import.meta.dev && hasSingleClick && !hasDoubleClick) {
      console.warn(
        `interactions: "${SINGLE_CLICK}" waits for a "${DOUBLE_CLICK}" that is not declared here, so all it does is answer a click late. Declare "${DOUBLE_CLICK}" beside it, or use "click".`,
      );
    }

    const undo = [];
    const mark = (attribute, value) => {
      element.setAttribute(attribute, value);
      undo.push(() => {
        element.removeAttribute(attribute);
      });
    };
    if (axes) {
      mark(SWIPE_AXES_ATTRIBUTE, axes);
      // Read by the boxes ABOVE this one: an axis swiped here is not theirs to
      // travel (see axesLeftBy).
      mark("data-travel-by-drag", axes);
      // …and nothing inside hands its leftover scroll to the page while the
      // element is being pulled.
      mark("data-drag-travel", axes);

      // A link and an image are draggable without anyone asking, and a native
      // drag IS press-and-move: the browser claims the gesture, takes the pointer
      // events with it and paints a ghost of the row the hand is trying to swipe.
      // Two things are needed, and neither covers the other:
      // - `draggable` refuses it on the element itself, before it starts;
      // - a swipe is usually a row with a link or a thumbnail INSIDE it, and
      //   those are draggable in their own right. `dragstart` bubbles, so
      //   refusing it here refuses theirs too — and it is the only refusal every
      //   browser honours (`-webkit-user-drag` is one engine's).
      // The cost is stated rather than worked around: an element that takes a
      // swipe cannot also be dragged out of the page, because there is one
      // gesture and it cannot mean both.
      mark("draggable", "false");
      const onDragStart = (dragStartEvent) => {
        dragStartEvent.preventDefault();
      };
      element.addEventListener("dragstart", onDragStart);
      undo.push(() => {
        element.removeEventListener("dragstart", onDragStart);
      });

      // A touch this element may take has to be refusable before the finger
      // lands, or the browser can cancel an established swipe mid-gesture by
      // scrolling the list around it along the axis touch-action leaves free —
      // same rule, same moment as the attributes above (see keepTouchRefusable).
      element.addEventListener("touchmove", keepTouchRefusable, {
        passive: false,
      });
      undo.push(() => {
        element.removeEventListener("touchmove", keepTouchRefusable);
      });
    }
    if (hasLongPress) {
      mark(LONGPRESS_ATTRIBUTE, "");
    }
    if (countsTaps) {
      mark(DOUBLE_CLICK_ATTRIBUTE, "");
    }

    // The tap a next press may pair with, and the window it is waited for in. It
    // outlives the press that made it — which is what a double click IS — so it
    // lives here rather than in the pointerdown below.
    let firstTap = null;
    let tapWindowTimeout = null;
    let tapWait = null;
    const forgetTaps = () => {
      clearTimeout(tapWindowTimeout);
      tapWindowTimeout = null;
      firstTap = null;
      tapWait?.cancel();
      tapWait = null;
    };
    undo.push(forgetTaps);
    // The window closes on a tap nothing came back for. Counted from the press
    // that opened it rather than from the tap that ends it, so what the caller
    // tunes is one rhythm and not a press plus a pause — a press slow enough to be
    // a hold therefore closes its own window on the spot, and cannot start a
    // double click.
    const openTapWindow = (pressEvent, tapEvent, delay) => {
      firstTap = {
        at: pressEvent.timeStamp,
        x: tapEvent.clientX,
        y: tapEvent.clientY,
        pointerType: tapEvent.pointerType,
      };
      if (hasSingleClick) {
        // The element's click is navi's from here: it is held for the length of
        // the window and `single_click` is what says it happened (see the top of
        // this file).
        const clickSuppressionIsOver = suppressClickAfterGesture();
        clickSuppressionIsOver();
      }
      clearTimeout(tapWindowTimeout);
      tapWindowTimeout = setTimeout(
        () => {
          tapWindowTimeout = null;
          firstTap = null;
          if (hasSingleClick) {
            trigger(SINGLE_CLICK, tapEvent, {
              pointerType: tapEvent.pointerType,
            });
          }
        },
        delay - (tapEvent.timeStamp - pressEvent.timeStamp),
      );
    };

    if (hasSingleClick) {
      // A click no press made — a keyboard activation, an `element.click()`. The
      // window exists to find out whether a second press is coming, and there is
      // no press here, so it is not held: said at once, the way the browser's own
      // click would have been.
      const onClick = (clickEvent) => {
        if (isPressDrivenClick(clickEvent)) {
          // A press's own click, swallowed by the suppression armed at its tap:
          // it never reaches here, and if it does (the suppression having already
          // been spent) the tap has said it or is about to.
          return;
        }
        trigger(SINGLE_CLICK, clickEvent, {
          pointerType: clickEvent.pointerType,
        });
      };
      element.addEventListener("click", onClick);
      undo.push(() => {
        element.removeEventListener("click", onClick);
      });
    }

    const onPointerDown = (pointerDownEvent) => {
      if (pointerDownEvent.button !== 0) {
        return;
      }
      let swipe = null;
      let press = null;
      // Set below, with the hold; a no-op until then so the swipe can call it.
      let forgetInnerLongPress = () => {};

      if (countsTaps) {
        const delay = readConfig(
          DOUBLE_CLICK_DELAY_ATTRIBUTE,
          DOUBLE_CLICK_DELAY_DEFAULT,
        );
        const slop = readConfig(
          DOUBLE_CLICK_SLOP_ATTRIBUTE,
          DOUBLE_CLICK_SLOP_DEFAULT,
        );
        // Whether this press is the second of a pair is settled HERE, when it
        // lands, and not when it is let go of: the window is about where the
        // hand went and how soon, and a second press held a little longer than
        // the window would otherwise be answered as a lone click while it is
        // still down.
        const completesTheFirstTap =
          firstTap && continuesTap(firstTap, pointerDownEvent, delay, slop);
        if (completesTheFirstTap) {
          clearTimeout(tapWindowTimeout);
          tapWindowTimeout = null;
        } else {
          forgetTaps();
        }
        tapWait = waitForTap(pointerDownEvent, {
          slop,
          onTap: (tapEvent) => {
            tapWait = null;
            if (completesTheFirstTap) {
              firstTap = null;
              // The click this second press leaves behind was already answered,
              // by the gesture the two of them made. Armed and released at once:
              // the release does not lift the suppression, it says the gesture is
              // over (see suppressClickAfterGesture).
              const clickSuppressionIsOver = suppressClickAfterGesture();
              clickSuppressionIsOver();
              trigger(DOUBLE_CLICK, tapEvent, {
                pointerType: tapEvent.pointerType,
              });
              return;
            }
            openTapWindow(pointerDownEvent, tapEvent, delay);
          },
        });
      }

      if (axes) {
        swipe = startSwipe(pointerDownEvent, {
          element,
          axes,
          types,
          trigger,
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
            forgetInnerLongPress();
            // …and it is not a tap either, nor the second of a pair: the press
            // has left, and what it left is a swipe.
            forgetTaps();
          },
        });
      }
      if (hasLongPress) {
        // A hold declared INSIDE this element, on this same press: the nearer
        // one answers, the way a click is the innermost target's, and this
        // wait is given up — two sheets opening from one hold is nobody's
        // intention. Delays being equal, the inner timer was set first (the
        // press reached it first) and fires first; the inner hold arrives here
        // as its own event, bubbling, before this timer runs.
        const onInnerLongPress = (longPressEvent) => {
          if (longPressEvent.target === element || !press) {
            return;
          }
          press.cancel();
          press = null;
          forgetInnerLongPress();
          warnOnceAboutHoldTakenByInner(element, longPressEvent.target);
        };
        forgetInnerLongPress = () => {
          element.removeEventListener("longpress", onInnerLongPress);
        };
        element.addEventListener("longpress", onInnerLongPress);
        press = waitForPressHeld(pointerDownEvent, {
          delay: readConfig(LONGPRESS_DELAY_ATTRIBUTE, LONGPRESS_DELAY_DEFAULT),
          slop: readConfig(LONGPRESS_SLOP_ATTRIBUTE, LONGPRESS_SLOP_DEFAULT),
          onPressCancel: forgetInnerLongPress,
          onPressHeld: (pressEvent, { endPress }) => {
            forgetInnerLongPress();
            // The hold won the arbitration: the swipe never got the distance it
            // needed, and must not get it from whatever the finger does next. The
            // double click loses the same way — a press held this long is the
            // hold's whether it is the first of a pair or the second.
            swipe?.stop();
            swipe = null;
            forgetTaps();
            const clickSuppressionIsOver = suppressClickAfterGesture();
            const onPointerEnd = () => {
              window.removeEventListener("pointerup", onPointerEnd, true);
              window.removeEventListener("pointercancel", onPointerEnd, true);
              endPress();
              clickSuppressionIsOver();
            };
            window.addEventListener("pointerup", onPointerEnd, true);
            window.addEventListener("pointercancel", onPointerEnd, true);
            trigger("longpress", pressEvent, {
              pointerType: pressEvent.pointerType,
            });
          },
        });
      }
    };
    element.addEventListener("pointerdown", onPointerDown);
    undo.push(() => {
      element.removeEventListener("pointerdown", onPointerDown);
    });

    return () => {
      for (const undoOne of undo) {
        undoOne();
      }
    };
  },
});

// Said once per element, in dev: the hold declared here can never fire while
// the one inside it is declared, and nothing else would tell — the outer one
// simply never happens. Two holds on the same pixels are usually one hold too
// many (see interactions.md); the fix is on the caller's side, so it has to be
// named there.
const holdTakenWarnedSet = new WeakSet();
const warnOnceAboutHoldTakenByInner = (element, innerElement) => {
  if (!import.meta.dev || holdTakenWarnedSet.has(element)) {
    return;
  }
  holdTakenWarnedSet.add(element);
  console.warn(
    `interactions: the "longpress" declared on this element was taken by the "longpress" declared inside it — the nearer hold wins, and this one never fires while the inner one is declared. One hold, one meaning: give the two things two gestures (a hold and a click, say), or declare the hold on one element only.`,
    element,
    innerElement,
  );
};

const startSwipe = (
  pointerDownEvent,
  { element, axes, types, trigger, threshold, onSwipeStart },
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
      const pending = trigger(type, event, {
        axis,
        sign,
        pulled,
        size,
        progress: pulled / size,
      });
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

// Whether a press landing now completes the tap before it: the same hand, soon
// enough, and near enough. Axis by axis rather than as a distance, the way every
// other slop in this family is read.
const continuesTap = (tap, pointerDownEvent, delay, slop) => {
  if (pointerDownEvent.pointerType !== tap.pointerType) {
    return false;
  }
  if (pointerDownEvent.timeStamp - tap.at >= delay) {
    return false;
  }
  const xApart = Math.abs(pointerDownEvent.clientX - tap.x);
  const yApart = Math.abs(pointerDownEvent.clientY - tap.y);
  return xApart < slop && yApart < slop;
};

const swipeTypeOf = (axis, pulled) => {
  const { positive, negative } = SWIPE_TYPE_BY_AXIS[axis];
  return pulled > 0 ? positive : negative;
};
