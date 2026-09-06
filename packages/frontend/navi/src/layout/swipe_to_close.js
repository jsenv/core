/**
 * Pushing a popup docked to an edge (a side panel, a bottom sheet) back the way
 * it came in closes it: it follows the finger while it travels, and letting go
 * either finishes the departure or brings it back to rest — whichever the
 * travel was already heading to.
 *
 * Reading the pointer is not done here: when a press becomes a gesture, which
 * axis it leans on, how fast it was going when it was let go, who else has a
 * claim on it (a field, a scroller with room left, a box inside the panel that
 * travels the same way) is one gesture system for the whole codebase
 * (@jsenv/dom's startDragToTravel). A panel closing is a travel of exactly one
 * box, towards the edge it is docked to and nowhere else — which is all this
 * file has to say.
 *
 * The release travel is driven here (Web Animations) rather than handed to the
 * exit transition the `animation` prop may install: its pace is what is left to
 * cover, which a CSS transition written for a full-size travel cannot know, and
 * two movements on the same property would contradict each other. So CSS
 * transitions are suppressed on the panel for the whole gesture, release
 * included, and restored once the panel has either left or come back.
 */

import { scrollRoomTowards, startDragToTravel } from "@jsenv/dom";

import { triggerNaviCommand } from "../control/commands.js";

// What a full-size release travel takes; a shorter one takes proportionally
// less, so the panel keeps the same speed whenever the finger let go.
const TRAVEL_DURATION = 220;

// Which way a popup docked to each side travels — read by the panel itself to
// say so in the DOM, which is how a box travelling INSIDE it (a row of slides,
// a route travel) knows that axis is already walked.
export const SWIPE_AXIS_BY_SIDE = {
  left: "x",
  right: "x",
  top: "y",
  bottom: "y",
};
// Which way the finger pushes to send the panel back where it came from, in
// screen coordinates: positive is right/down, the same sign the gesture reports.
const CLOSE_DIRECTION_BY_SIDE = { left: -1, right: 1, top: -1, bottom: 1 };

/**
 * Builds the `pointerdown` handler a popup docked to `side` answers with.
 *
 * `grip` says where the gesture may start, as a selector the pressed element is
 * matched against with `closest`. A popup that names one is held THERE and
 * nowhere else: everything else it holds is content the finger came to operate,
 * and a press on it is that content's — including gestures of its own, which
 * this file has no way of knowing about. A popup that names no grip is pushed
 * from its whole surface, which only suits one made of nothing else (a side
 * panel showing a page).
 */
export const createSwipeToClose = (side, { grip } = {}) => {
  const axis = SWIPE_AXIS_BY_SIDE[side];
  const closeDirection = CLOSE_DIRECTION_BY_SIDE[side];

  return (pointerDownEvent) => {
    const panelEl = pointerDownEvent.currentTarget;
    if (panelEl.getAttribute("aria-expanded") !== "true") {
      return;
    }
    if (grip) {
      // Read from the press outwards rather than by looking the grip up in the
      // panel: a popup may hold several (a header and whatever else was marked
      // as one), and where they sit in it is the application's business.
      const gripEl = pointerDownEvent.target.closest(grip);
      if (!gripEl || !panelEl.contains(gripEl)) {
        return;
      }
    }

    // How far the panel has been pulled, as the style showing it — written on
    // the panel while the finger drives it, handed to the release travel as
    // its two keyframes. The gesture reports a distance in screen coordinates,
    // which is exactly what a translate takes; it goes through `transform`
    // because the `translate` property carries where the panel *stands*
    // (applyNewPosition in visible_rect.js, which owns it), so the pull
    // composes under the placement instead of replacing it.
    const styleAt = (distance) => ({
      transform: translateOf(axis, distance),
      clipPath: clipOf(side, distance),
    });
    const paint = (distance) => {
      Object.assign(panelEl.style, styleAt(distance));
    };
    const restore = () => {
      panelEl.style.transform = "";
      panelEl.style.clipPath = "";
      panelEl.style.transitionProperty = "";
      panelEl.style.userSelect = "";
    };
    // The resting value is written first and the animation only covers the way
    // to it: both end on the same number, so nothing is seen changing when the
    // animation hands the panel back to its own style.
    const travelTo = (from, to, onArrival) => {
      const covered = from > to ? from - to : to - from;
      paint(to);
      const animation = panelEl.animate([styleAt(from), styleAt(to)], {
        duration: (covered / sizeOf(panelEl, axis)) * TRAVEL_DURATION,
        easing: "ease-out",
      });
      animation.finished.then(onArrival, () => {});
    };
    const close = (event) => {
      triggerNaviCommand(panelEl, "--navi-close", event);
      if (panelEl.getAttribute("aria-expanded") === "true") {
        // Refused: the panel is staying, so it goes back where it was.
        travelTo(sizeOf(panelEl, axis) * closeDirection, 0, restore);
        return;
      }
      restore();
    };

    startDragToTravel(pointerDownEvent, {
      element: panelEl,
      axes: axis,
      onStart: ({ sign, target }) => {
        if (sign !== closeDirection) {
          // Pushing the panel further in is not a travel: there is nowhere that
          // way, and reading it as one would make the panel lean at every
          // gesture that starts by going the wrong way.
          return false;
        }
        const size = sizeOf(panelEl, axis);
        if (!size) {
          return false;
        }
        // Something else with a better claim on the gesture: a scroller between
        // the finger and the panel, with room left that way.
        if (scrollRoomTowards(target, panelEl, axis, sign)) {
          return false;
        }
        panelEl.style.transitionProperty = "none";
        panelEl.style.userSelect = "none";
        // What the first pixels of the gesture may have started selecting is
        // not a selection, it is the beginning of this travel.
        window.getSelection().removeAllRanges();
        // The way out is the only way there is anything: pulling the other way
        // leans against a wall and comes back.
        return {
          size,
          travelBack: closeDirection > 0,
          travelOn: closeDirection < 0,
        };
      },
      onPull: ({ pulled }) => {
        paint(pulled);
      },
      onEnd: ({ pulled, size, travels, event }) => {
        if (travels) {
          travelTo(pulled, size * closeDirection, () => close(event));
          return;
        }
        travelTo(pulled, 0, restore);
      },
    });
  };
};

const sizeOf = (element, axis) => {
  const rect = element.getBoundingClientRect();
  return axis === "x" ? rect.width : rect.height;
};
const translateOf = (axis, distance) =>
  axis === "x"
    ? `translate(${distance}px, 0px)`
    : `translate(0px, ${distance}px)`;
// The same cut the entry/exit animation makes (popup_css.js), at a distance the
// finger decides instead of a transition: the edge the popup is pushed back
// through, as popup_css.js placed it (--x-popup-cut-*-at-area — on the area's
// edge where a band of glass lies past it, 100vmax out where the window's own
// edge does the cutting), plus what has been pulled, so the cut holds that line
// while the box travels under it. The three other sides are left far outside
// the box — the pull never takes the popup past them, and cutting there would
// only shave what it legitimately paints outside its own box. Reading the
// policy from popup_css.js rather than the rooms keeps the release travel
// (a Web Animation on transform AND clip-path, two clocks) from animating a
// cut the entrance would not.
const UNCUT = "-100vmax";
const clipOf = (side, distance) => {
  const pulled = distance < 0 ? -distance : distance;
  const cut = `calc(var(--x-popup-cut-${side}-at-area, ${UNCUT}) + ${pulled}px)`;
  if (side === "top") {
    return `inset(${cut} ${UNCUT} ${UNCUT} ${UNCUT})`;
  }
  if (side === "right") {
    return `inset(${UNCUT} ${cut} ${UNCUT} ${UNCUT})`;
  }
  if (side === "bottom") {
    return `inset(${UNCUT} ${UNCUT} ${cut} ${UNCUT})`;
  }
  return `inset(${UNCUT} ${UNCUT} ${UNCUT} ${cut})`;
};
