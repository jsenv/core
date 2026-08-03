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

const createSlideshow = ({ axis, gap, duration, getSlotSize }) => {
  const members = [];
  // A member can say what gap it keeps with its container (a dialog knows its
  // own marginWithContainer): it is the same distance, so the slideshow uses it
  // rather than a number repeated at the call site. The prop stays as the
  // fallback for members that have nothing to say.
  let gapFromMembers;
  const slotSize = () => getSlotSize() + (gapFromMembers ?? gap);
  const slideshow = {
    axis,
    members,
    /**
     * @param {HTMLElement} element - the member arriving on screen; it becomes
     *   the current one, everything already registered shifts back by a slot.
     * @returns {boolean} whether it travelled — false for the very first slide,
     *   which is simply there and keeps its own animation.
     * @param {object} [options]
     * @param {"y"|"x"} [options.axis="y"] - how the members are laid out.
     * @param {number} [options.gap=0] - kept between two members, so they never
     *   travel edge to edge.
     */
    add: (element, { gap: gapFromMember } = {}) => {
      if (typeof gapFromMember === "number") {
        gapFromMembers = gapFromMember;
      }
      if (members.includes(element)) {
        return false;
      }
      if (members.length === 0) {
        // The first slide is not a page change: there is nothing to come from,
        // so it is simply there — and it keeps whatever animation of its own it
        // has, which is why this answers whether it travelled.
        members.push(element);
        slideshow.apply();
        return false;
      }
      // Placed one slot ahead first, with no transition: that is where a new
      // slide comes FROM. Everything then moves by exactly one slot — the
      // arrival and the departure are the same movement, so they cannot differ
      // in distance or in duration.
      element.setAttribute("data-slideshow-instant", "");
      element.style.setProperty("--slideshow-offset", `${slotSize()}px`);
      members.push(element);
      // The travel starts on the NEXT frame, not on the next line: the browser
      // has to paint the slide at its starting place before it can transition
      // away from it — a dialog is displayed on the very frame it opens, so
      // doing both in one go simply shows it at its final place.
      requestAnimationFrame(() => {
        element.removeAttribute("data-slideshow-instant");
        slideshow.apply();
      });
      return true;
    },
    remove: (element) => {
      const index = members.indexOf(element);
      if (index === -1) {
        return false;
      }
      members.splice(index, 1);
      if (members.length === 0) {
        // The first page leaving is not a page change either: nothing stays
        // behind for it to make room for, so it goes the way it came — by its
        // own animation, not by a slot.
        element.style.removeProperty("--slideshow-offset");
        element.style.removeProperty("--slideshow-duration");
        return false;
      }
      // It leaves the way the next one arrived: one slot forward. Out of the
      // arithmetic already, so the others take their new places at the same
      // time, and its own variables are dropped once it has arrived — leaving
      // them would put it back a slot the next time it opens.
      element.style.setProperty("--slideshow-offset", `${slotSize()}px`);
      // Leaving, so out of reach too — the page coming back is the one the
      // pointer is aiming at, from the very first frame of the travel.
      element.setAttribute("data-slideshow-displaced", "");
      const onTravelEnd = (transitionEvent) => {
        // Only the travel: display and overlay ride the same transition list
        // and end at once, and cleaning up on those would put the slide back
        // at zero before it has moved an inch.
        if (transitionEvent.propertyName !== "translate") {
          return;
        }
        element.removeEventListener("transitionend", onTravelEnd);
        element.style.removeProperty("--slideshow-offset");
        element.style.removeProperty("--slideshow-duration");
        element.removeAttribute("data-slideshow-displaced");
      };
      element.addEventListener("transitionend", onTravelEnd);
      slideshow.apply();
      return true;
    },
    apply: () => {
      const slot = slotSize();
      const lastIndex = members.length - 1;
      let index = 0;
      while (index < members.length) {
        const member = members[index];
        // Negative for everything behind the current one: they have already
        // been walked past. One slot each, so two neighbours are always exactly
        // one slot apart, whatever their own sizes.
        const offset = (index - lastIndex) * slot;
        member.style.setProperty("--slideshow-offset", `${offset}px`);
        // Walked past, so not there for the pointer: only the current page
        // answers. Set as soon as it steps back — waiting for the travel to end
        // would leave a surface on its way out catching clicks meant for the
        // one coming back.
        if (offset === 0) {
          member.removeAttribute("data-slideshow-displaced");
        } else {
          member.setAttribute("data-slideshow-displaced", "");
        }
        // The duration belongs to the slideshow, not to each member: one
        // movement, one speed, whatever animation a member has of its own.
        if (duration) {
          member.style.setProperty("--slideshow-duration", duration);
        }
        index++;
      }
    },
  };
  return slideshow;
};

const css = /* css */ `
  /* Positioned, because that is the whole point of the material container: a
     layer="local" popup resolves its own placement against its nearest
     positioned ancestor, and here that ancestor is the slideshow. relative
     rather than anything else so it keeps its place in the flow. */
  .navi_slideshow {
    position: relative;
  }
`;

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
 * @param {number} [props.gap=0] - kept between two slides, when the members
 *   themselves say nothing (a Dialog passes its own marginWithContainer).
 * @param {string} [props.duration="300ms"] - how long one slide takes; the
 *   slideshow owns it so every member travels at the same speed.
 */
export const SlideShow = ({
  layer = "top",
  axis = "y",
  gap = 0,
  duration = "300ms",
  children,
  // Only the material container can wear them — a top-layer slideshow has no
  // box of its own to style.
  ...rest
}) => {
  import.meta.css = css;
  const ref = useRef();
  const slideshow = useMemo(
    () =>
      createSlideshow({
        axis,
        gap,
        duration,
        getSlotSize: () => {
          if (layer === "top") {
            return axis === "x" ? window.innerWidth : window.innerHeight;
          }
          // Local: this element IS the container its pages live in.
          const container = ref.current;
          if (!container) {
            return 0;
          }
          return axis === "x" ? container.clientWidth : container.clientHeight;
        },
      }),
    [layer, axis, gap, duration],
  );

  if (layer === "local") {
    // A real box, because a local popup needs one: it is the positioned
    // ancestor its pages are confined to and measured against — a slot is the
    // container's own size, not the viewport's, which is what makes the whole
    // thing work for surfaces that size to their content (a popover) rather
    // than to the screen (a dialog).
    return (
      <div {...rest} ref={ref} className="navi_slideshow">
        <SlideShowContext.Provider value={slideshow}>
          {children}
        </SlideShowContext.Provider>
      </div>
    );
  }
  return (
    // display: contents — nothing to contain here: top-layer pages are out of
    // the flow, and this must not disturb the layout around it. It stays an
    // element only so the arithmetic has somewhere to live.
    <span ref={ref} style="display: contents">
      <SlideShowContext.Provider value={slideshow}>
        {children}
      </SlideShowContext.Provider>
    </span>
  );
};
