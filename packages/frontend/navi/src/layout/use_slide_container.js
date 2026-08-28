/**
 * What a SlideContainer is doing, read from outside it.
 *
 * Only slides go in the box, so everything drawn AROUND the travel is written
 * around it — a chevron pinned to the edge of a full-screen viewer, a "3 / 8"
 * counter, a bar. Those need to know things the box alone knows: where one is,
 * and whether there is anywhere to go that way. A container driven by nobody
 * (no `current`, no `signal`) knows them and no one else does, so this is also
 * what keeps such a container usable without lifting its state out of it.
 *
 * Two channels, and they answer two different questions. The attributes the box
 * paints on itself are the STATE: they are there for whoever arrives later, and
 * CSS draws with them without any of this ([data-slide-ways~="right"]). The
 * event it dispatches is the NEWS: it says WHEN something changed, which no
 * attribute can say. So this reads the first and listens to the second.
 *
 * Not watching the DOM for it, which is the tempting third way and the wrong
 * one: a write is not a change. Under a finger the box writes where the picture
 * leans on every frame, with the same value in it more often than not, and a
 * watcher is woken for every one of them — while the box itself knows perfectly
 * well whether anything is different, and says so once.
 *
 * Nothing is told to the box in return, and nothing has to be wired: it
 * announces to itself and to its followers, so the thing doing the reading sits
 * anywhere on the page — in a fixed bar, in the frame around the box, in a
 * dialog holding it — and a container which never re-renders (a travel it drove
 * itself) is still followed.
 *
 * Reading only. Asking for a travel is what it always was: a command aimed at
 * the box (`commandFor={id}` + `--navi-right`, or triggerNaviCommand) — one way
 * of asking, wherever the asking is written.
 */

import { useContext, useLayoutEffect, useState } from "preact/hooks";

import { SlideContainerContext } from "./slide_container_context.js";

// The vocabulary the box publishes, in one place: written by slide_container,
// read here and by anything styling in CSS alone
// ([data-slide-ways~="right"]).
export const SLIDE_CURRENT_ATTRIBUTE = "data-slide-current";
export const SLIDE_TOWARD_ATTRIBUTE = "data-slide-travel-toward";
// Every way out that would DO something right now, in the words the commands
// use: a direction ("left", "right", "up", "down") when there is a slide that
// way, plus "first" and "last" when one is not already standing at that end of
// the walk — and, in all cases, the slide on screen letting go.
export const SLIDE_WAYS_ATTRIBUTE = "data-slide-ways";
// …and the ways out that are there and refused: the slide on screen holds on to
// the user that way (preventNav, or a `required` step still unanswered). Two
// facts, not one: a way out leading nowhere is not there at all, while a way
// out being held IS there and says no — which is why it stays visible and
// explainable rather than hidden. A way out is dead in both cases.
export const SLIDE_HELD_ATTRIBUTE = "data-slide-held";
// …and the one word said out loud, on the box and on every follower of it, when
// any of the above has actually changed. It carries the whole state as its
// detail, so `onnavi_slide_state` on the box is a way of hearing it too.
export const SLIDE_STATE_EVENT = "navi_slide_state";

const NO_WAYS = [];
// No box to read: not "a box with nothing in it". The difference is the whole
// point — see `can` below, which must not answer "there is nowhere to go" to
// the question "where can one go" when it has not been told anything yet.
const NOTHING = {
  known: false,
  current: undefined,
  toward: undefined,
  areas: NO_WAYS,
  ways: NO_WAYS,
  held: NO_WAYS,
};

const wordsOf = (element, attribute) => {
  const value = element.getAttribute(attribute);
  return value ? value.split(" ") : NO_WAYS;
};

export const readSlideContainerState = (element) => ({
  known: true,
  current: element.getAttribute(SLIDE_CURRENT_ATTRIBUTE) ?? undefined,
  toward: element.getAttribute(SLIDE_TOWARD_ATTRIBUTE) ?? undefined,
  // In DOM order — which is the order of the WALK for a line, and not
  // necessarily for a map: there the order is the one the areas are written in
  // (see parseAreas). Ask `can("first")` / `can("last")` about the ends rather
  // than the two ends of this list.
  areas: Array.from(
    element.querySelectorAll(":scope > [data-slide-track] > [data-slide]"),
    (slideElement) =>
      slideElement.getAttribute("data-slide-area") || slideElement.id || "",
  ),
  ways: wordsOf(element, SLIDE_WAYS_ATTRIBUTE),
  held: wordsOf(element, SLIDE_HELD_ATTRIBUTE),
});

export const sameSlideContainerState = (a, b) =>
  a.known === b.known &&
  a.current === b.current &&
  a.toward === b.toward &&
  a.areas.join(" ") === b.areas.join(" ") &&
  a.ways.join(" ") === b.ways.join(" ") &&
  a.held.join(" ") === b.held.join(" ");

/**
 * @param {string|Element|{current: Element}} [target] - the container: its id
 *   (the way everything else addresses one), the element, or a ref to it. Not a
 *   follower — a follower is painted for CSS to draw with, the box is what holds
 *   the walk. Left out, it is the box this is written INSIDE, if any: a way out
 *   reads the same facts on either side of the box, which is the whole point of
 *   there being one answer to "what would this do".
 * @returns {{
 *   known: boolean,
 *   current: string|undefined,
 *   toward: string|undefined,
 *   areas: string[],
 *   can: (wayOut: "left"|"right"|"up"|"down"|"first"|"last") => boolean,
 *   held: (wayOut: "left"|"right"|"up"|"down"|"first"|"last") => boolean,
 * }} where the box stands. `current` is the slide on screen — the one being
 *   travelled TO while a travel plays, because that is what one is looking at;
 *   `toward` is the other slide in the frame while the picture is between two,
 *   and nothing at rest. `can` is "asking for it would do something", `held` is
 *   "it is there and this slide says no" — a way out is dead in both cases, and
 *   only the second is worth a word to the reader.
 *   `known` is false until the box has been read: no box was named and none is
 *   above, the id names nothing, or — for one commit — this mounted before the
 *   box had painted. Until then `can` answers YES, because it is the answer that
 *   degrades well: a way out offered for one frame and then taken away is a
 *   button that did nothing once, while the reverse hides every way out of every
 *   box that this cannot see and says nothing about it.
 */
export const useSlideContainer = (target) => {
  const [state, setState] = useState(NOTHING);
  // The box this is written inside, when nothing names one. Read
  // unconditionally, like every hook, and used only as a fallback.
  const containerInContext = useContext(SlideContainerContext);
  const fallbackRef = containerInContext?.containerRef;

  useLayoutEffect(() => {
    const resolved = target ?? fallbackRef;
    const element =
      typeof resolved === "string"
        ? document.getElementById(resolved)
        : resolved && "current" in resolved
          ? resolved.current
          : resolved;
    if (!element) {
      if (typeof resolved === "string") {
        console.warn(
          `useSlideContainer("${resolved}") but no element with that id found`,
        );
      }
      setState(NOTHING);
      return undefined;
    }
    // Read off the DOM rather than taken from the event's detail, even though
    // the two say the same thing: the first read has no event to take it from
    // (the box was already standing somewhere when this mounted), and one way
    // of reading is one thing that can be wrong.
    const read = () => {
      const nextState = readSlideContainerState(element);
      setState((previous) =>
        sameSlideContainerState(previous, nextState) ? previous : nextState,
      );
    };
    read();
    element.addEventListener(SLIDE_STATE_EVENT, read);
    return () => {
      element.removeEventListener(SLIDE_STATE_EVENT, read);
    };
  }, [target, fallbackRef]);

  return {
    known: state.known,
    current: state.current,
    toward: state.toward,
    areas: state.areas,
    can: (wayOut) => !state.known || state.ways.includes(wayOut),
    held: (wayOut) => state.held.includes(wayOut),
  };
};
