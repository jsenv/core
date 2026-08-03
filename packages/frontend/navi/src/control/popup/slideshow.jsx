/**
 * A slideshow is a carousel whose container does not exist.
 *
 * A top-layer dialog is taken out of the flow by the browser, so no common
 * ancestor can hold two of them side by side and translate the pair. What can
 * be shared instead is the *arithmetic*: each dialog registers here when it
 * opens, gets a rank, and is told how far to move — everyone by the same
 * amount, one slot per rank. Same amount means the gap between two of them
 * cannot drift, which is the whole reason a real carousel keeps its slides
 * aligned. The dialogs themselves know nothing about each other.
 *
 * A slot is the space one member occupies before the next begins: the viewport
 * along the axis, plus the gap asked for. So the member on screen sits at 0,
 * the one before it at -1 slot, the one before that at -2, and so on.
 *
 * <SlideShow> below is only the way to declare who takes part: membership
 * comes from the tree, and the arithmetic stays here.
 */

import { createContext } from "preact";
import { useMemo, useRef } from "preact/hooks";

const createSlideshow = ({ axis, gap, getSlotSize }) => {
  const members = [];
  const slideshow = {
    axis,
    members,
    /**
     * @param {HTMLElement} element - the member arriving on screen; it becomes
     *   the current one, everything already registered shifts back by a slot.
     * @param {object} [options]
     * @param {"y"|"x"} [options.axis="y"] - how the members are laid out.
     * @param {number} [options.gap=0] - kept between two members, so they never
     *   travel edge to edge.
     */
    add: (element) => {
      if (members.includes(element)) {
        return;
      }
      members.push(element);
      slideshow.apply();
    },
    remove: (element) => {
      const index = members.indexOf(element);
      if (index === -1) {
        return;
      }
      members.splice(index, 1);
      // The element that leaves goes back to its own place: it is no longer
      // part of the arithmetic, and its own exit animation takes over.
      element.style.removeProperty("--slideshow-offset");
      slideshow.apply();
    },
    apply: () => {
      const slot = getSlotSize() + gap;
      const lastIndex = members.length - 1;
      let index = 0;
      while (index < members.length) {
        const member = members[index];
        // Negative for everything behind the current one: they have already
        // been walked past. One slot each, so two neighbours are always exactly
        // one slot apart, whatever their own sizes.
        const offset = (index - lastIndex) * slot;
        member.style.setProperty("--slideshow-offset", `${offset}px`);
        index++;
      }
    },
  };
  return slideshow;
};

const findPositionedAncestor = (element) => {
  let ancestor = element?.parentElement;
  while (ancestor) {
    const { position } = getComputedStyle(ancestor);
    if (position !== "static") {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return null;
};

export const SlideShowContext = createContext(null);

/**
 * Wrap the surfaces that move together. Membership comes from the tree, so
 * nothing has to be named, and a surface outside it is simply not part of it.
 *
 * @param {object} props
 * @param {"top"|"local"} [props.layer="top"] - what one slide is measured
 *   against: the viewport, or the positioned ancestor this renders into (the
 *   same distinction Dialog and Popover make about where they live).
 * @param {"y"|"x"} [props.axis="y"] - how the slides are laid out.
 * @param {number} [props.gap=0] - kept between two slides.
 */
export const SlideShow = ({ layer = "top", axis = "y", gap = 0, children }) => {
  const ref = useRef();
  const slideshow = useMemo(
    () =>
      createSlideshow({
        axis,
        gap,
        getSlotSize: () => {
          if (layer === "top") {
            return axis === "x" ? window.innerWidth : window.innerHeight;
          }
          // Local: the container is the positioned ancestor this element sits
          // in — the very one a layer="local" Dialog resolves for itself.
          // Walked by hand rather than read from offsetParent: this element is
          // display:contents, so it has no box and no offsetParent at all.
          const container = findPositionedAncestor(ref.current);
          if (!container) {
            return 0;
          }
          return axis === "x" ? container.clientWidth : container.clientHeight;
        },
      }),
    [layer, axis, gap],
  );

  return (
    // display: contents — it must not disturb the layout of what surrounds it.
    // It exists to find the container in layer="local"; top-layer children are
    // out of the flow anyway.
    <span ref={ref} style="display: contents">
      <SlideShowContext.Provider value={slideshow}>
        {children}
      </SlideShowContext.Provider>
    </span>
  );
};
