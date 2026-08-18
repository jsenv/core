/**
 * Pushing a side panel back the way it came in closes it: the panel follows
 * the finger while it travels, and letting go either finishes the departure or
 * brings it back to rest — whichever the travel was already heading to.
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

// Which way a panel docked to each side travels — read by the panel itself to
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
 * Builds the `pointerdown` handler a side panel docked to `side` answers with.
 */
export const createSwipeToClose = (side) => {
  const axis = SWIPE_AXIS_BY_SIDE[side];
  const closeDirection = CLOSE_DIRECTION_BY_SIDE[side];

  return (pointerDownEvent) => {
    const panelEl = pointerDownEvent.currentTarget;
    if (panelEl.getAttribute("aria-expanded") !== "true") {
      return;
    }

    // Where the panel stands, written on it directly: the gesture reports a
    // distance in screen coordinates, which is exactly what a translate takes.
    const paint = (distance) => {
      panelEl.style.translate =
        axis === "x" ? `${distance}px 0px` : `0px ${distance}px`;
    };
    const restore = () => {
      panelEl.style.translate = "";
      panelEl.style.transitionProperty = "";
      panelEl.style.userSelect = "";
    };
    // The resting value is written first and the animation only covers the way
    // to it: both end on the same number, so nothing is seen changing when the
    // animation hands the panel back to its own style.
    const travelTo = (from, to, onArrival) => {
      const covered = from > to ? from - to : to - from;
      paint(to);
      const animation = panelEl.animate(
        [
          { translate: translateOf(axis, from) },
          { translate: translateOf(axis, to) },
        ],
        {
          duration: (covered / sizeOf(panelEl, axis)) * TRAVEL_DURATION,
          easing: "ease-out",
        },
      );
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
  axis === "x" ? `${distance}px 0px` : `0px ${distance}px`;
