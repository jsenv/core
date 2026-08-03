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

import { createContext, toChildArray } from "preact";
import { Box } from "../../box/box.jsx";
import { onNaviCommand } from "../commands.js";
import { useMemo, useRef, useState } from "preact/hooks";

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
    /* Fills what holds it: its pages are absolutely positioned, so it has no
       content to take a size from — left alone it would measure 0 and a slot
       with it. A caller wanting another size sets one; this is only what makes
       "as big as where I am" the default. */
    width: 100%;
    height: 100%;
  }
`;

export const SlideShowContext = createContext(null);

/**
 * Wrap the surfaces that move together. Membership comes from the tree, so
 * nothing has to be named, and a surface outside it is simply not part of it.
 *
 * @param {object} props
 * @param {"top"} [props.layer="top"] - what one slide is measured against.
 *   Only "top" for now: a popup is promoted to the browser's top layer, so no
 *   container of ours can hold two of them side by side — a slideshow of
 *   CONTENTS inside a single popup is the shape that case needs, and it is not
 *   built yet.
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

const contentCss = /* css */ `
  /* Every page in the same grid cell: the box then measures itself on the
     LARGEST of them, in both directions, without anything being measured by
     hand — which is also why nothing here resizes as the pages change. Each
     page travels by exactly one box, so a short one and a tall one move the
     same distance. */
  .navi_slideshow_content {
    display: grid;
    overflow: hidden;

    > [data-slideshow-page] {
      /* So a page shorter than the box still fills it: the box is as big as its
         largest page, and the others stretch to it rather than floating in a
         corner of it. */
      display: grid;
      min-width: 0;
      min-height: 0;
      grid-area: 1 / 1;
      translate: var(--slideshow-offset, 0);
      transition: translate var(--slideshow-duration, 300ms) ease;
    }
    /* Parked: not shown, and not in the way of what is. */
    > [data-slideshow-page][data-slideshow-displaced] {
      pointer-events: none;
    }
  }
`;

/**
 * Pages that replace one another inside one box.
 *
 * Horizontal by default — a page arrives from the side, the way one walks
 * through a form — and vertical with `vertical`, where it arrives from below.
 * The box takes the size of its largest page (see the CSS above), so nothing
 * grows or shrinks as one moves through them.
 *
 * The page shown can be driven from outside (`current` + `onCurrentChange`) or
 * left to the slideshow, which then answers the --navi-next/--navi-previous
 * commands sent from anything inside it.
 *
 * @param {object} props
 * @param {string} [props.current] - id of the page being shown; omit to let the
 *   slideshow keep it and drive it by command.
 * @param {(id: string) => void} [props.onCurrentChange]
 * @param {boolean} [props.vertical] - pages travel up and down instead of
 *   sideways.
 * @param {string} [props.duration="300ms"] - how long a page change takes.
 */
export const SlideShowContent = ({
  current: currentProp,
  onCurrentChange,
  vertical,
  duration = "300ms",
  children,
  ...rest
}) => {
  import.meta.css = contentCss;
  const pages = toChildArray(children);
  const pageIds = pages.map((page, index) => page.props?.id ?? String(index));
  const [currentState, setCurrentState] = useState(pageIds[0]);
  const current = currentProp ?? currentState;
  const currentIndex = Math.max(0, pageIds.indexOf(current));

  const goTo = (index) => {
    const id = pageIds[Math.max(0, Math.min(index, pageIds.length - 1))];
    if (id === current) {
      return;
    }
    setCurrentState(id);
    onCurrentChange?.(id);
  };

  return (
    // Box rather than a plain div: it is how every navi component takes the
    // onnavi_* handlers below — they are navi's own event names, and Box is
    // what carries them onto the element.
    <Box
      {...rest}
      baseClassName="navi_slideshow_content"
      data-slideshow-content=""
      // The event a --navi-next/--navi-previous command ends up dispatching…
      onnavi_slideshow_go={(e) => {
        goTo(currentIndex + e.detail.step);
      }}
      // …and the protocol every command target answers: without this the
      // command resolves, finds this element, and nothing runs.
      onnavi_command={(e) => {
        onNaviCommand(e);
      }}
      style={{ "--slideshow-duration": duration, ...rest.style }}
    >
      {pages.map((page, index) => {
        const isCurrent = index === currentIndex;
        const distance = `${(index - currentIndex) * 100}%`;
        return (
          <div
            key={pageIds[index]}
            data-slideshow-page=""
            data-current={isCurrent ? "" : undefined}
            data-slideshow-displaced={isCurrent ? undefined : ""}
            style={{
              "--slideshow-offset": vertical
                ? `0 ${distance}`
                : `${distance} 0`,
            }}
            aria-hidden={isCurrent ? undefined : "true"}
          >
            {page}
          </div>
        );
      })}
    </Box>
  );
};

/**
 * One page. Nothing but a Box with the id the slideshow moves it by — it exists
 * so a page reads as a page rather than as a box that happens to carry an id.
 */
const SlideShowItem = ({ children, ...rest }) => (
  <Box flex="y" {...rest}>
    {children}
  </Box>
);
SlideShowContent.Item = SlideShowItem;
