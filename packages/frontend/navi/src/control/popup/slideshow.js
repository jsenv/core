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
 * Written as a plain registry rather than a component precisely because there
 * is nothing to render: it is a place to agree on positions.
 */

const slideshowMap = new Map();

export const getSlideshow = (name) => {
  const existing = slideshowMap.get(name);
  if (existing) {
    return existing;
  }
  const members = [];
  const slideshow = {
    name,
    members,
    /**
     * @param {HTMLElement} element - the member arriving on screen; it becomes
     *   the current one, everything already registered shifts back by a slot.
     * @param {object} [options]
     * @param {"y"|"x"} [options.axis="y"] - how the members are laid out.
     * @param {number} [options.gap=0] - kept between two members, so they never
     *   travel edge to edge.
     */
    add: (element, { axis = "y", gap = 0 } = {}) => {
      if (members.includes(element)) {
        return;
      }
      members.push(element);
      slideshow.apply({ axis, gap });
    },
    remove: (element, { axis = "y", gap = 0 } = {}) => {
      const index = members.indexOf(element);
      if (index === -1) {
        return;
      }
      members.splice(index, 1);
      // The element that leaves goes back to its own place: it is no longer
      // part of the arithmetic, and its own exit animation takes over.
      element.style.removeProperty("--slideshow-offset");
      slideshow.apply({ axis, gap });
    },
    apply: ({ axis = "y", gap = 0 } = {}) => {
      const slot =
        (axis === "x" ? window.innerWidth : window.innerHeight) + gap;
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
  slideshowMap.set(name, slideshow);
  return slideshow;
};
