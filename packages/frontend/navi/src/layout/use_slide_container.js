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

import { useLayoutEffect, useState } from "preact/hooks";

// The vocabulary the box publishes, in one place: written by slide_container,
// read here and by anything styling in CSS alone
// ([data-slide-ways~="right"]).
export const SLIDE_CURRENT_ATTRIBUTE = "data-slide-current";
export const SLIDE_TOWARD_ATTRIBUTE = "data-slide-travel-toward";
// Where a travel WOULD go right now: there is a slide that way and the one on
// screen lets go of it.
export const SLIDE_WAYS_ATTRIBUTE = "data-slide-ways";
// …and where there is a slide that way but the one on screen holds on to the
// user (preventNav, or a `required` step still unanswered). Two facts, not one:
// a way out leading nowhere is not there, while a way out being held is there
// and says no — which is why it stays visible and explainable rather than
// hidden.
export const SLIDE_HELD_ATTRIBUTE = "data-slide-held";
// …and the one word said out loud, on the box and on every follower of it, when
// any of the above has actually changed. It carries the whole state as its
// detail, so `onnavi_slide_state` on the box is a way of hearing it too.
export const SLIDE_STATE_EVENT = "navi_slide_state";

const NO_WAYS = [];
const NOTHING = {
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
  current: element.getAttribute(SLIDE_CURRENT_ATTRIBUTE) ?? undefined,
  toward: element.getAttribute(SLIDE_TOWARD_ATTRIBUTE) ?? undefined,
  // In DOM order, which is the order of the walk for a line and the order the
  // areas were written in for a map — the same order everything else reads
  // (see readMap).
  areas: Array.from(
    element.querySelectorAll(":scope > [data-slide-track] > [data-slide]"),
    (slideElement) =>
      slideElement.getAttribute("data-slide-area") || slideElement.id || "",
  ),
  ways: wordsOf(element, SLIDE_WAYS_ATTRIBUTE),
  held: wordsOf(element, SLIDE_HELD_ATTRIBUTE),
});

export const sameSlideContainerState = (a, b) =>
  a.current === b.current &&
  a.toward === b.toward &&
  a.areas.join(" ") === b.areas.join(" ") &&
  a.ways.join(" ") === b.ways.join(" ") &&
  a.held.join(" ") === b.held.join(" ");

/**
 * @param {string|Element|{current: Element}} [target] - the container: its id
 *   (the way everything else addresses one), the element, or a ref to it. Not a
 *   follower — a follower is painted for CSS to draw with, the box is what holds
 *   the walk. Nothing at all is allowed and answers "no container": a component
 *   that may or may not be wired to one calls this unconditionally, like every
 *   hook.
 * @returns {{
 *   current: string|undefined,
 *   toward: string|undefined,
 *   areas: string[],
 *   can: (direction: "left"|"right"|"up"|"down") => boolean,
 *   held: (direction: "left"|"right"|"up"|"down") => boolean,
 * }} where the box stands. `current` is the slide on screen — the one being
 *   travelled TO while a travel plays, because that is what one is looking at;
 *   `toward` is the other slide in the frame while the picture is between two,
 *   and nothing at rest. `can` is "a travel that way would happen", `held` is
 *   "there is a slide that way and this one says no" — a chevron is dead in
 *   both cases and only the second is worth explaining.
 */
export const useSlideContainer = (target) => {
  const [state, setState] = useState(NOTHING);

  useLayoutEffect(() => {
    const element =
      typeof target === "string"
        ? document.getElementById(target)
        : target && "current" in target
          ? target.current
          : target;
    if (!element) {
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
  }, [target]);

  return {
    current: state.current,
    toward: state.toward,
    areas: state.areas,
    can: (direction) => state.ways.includes(direction),
    held: (direction) => state.held.includes(direction),
  };
};
