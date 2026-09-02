/**
 * TabList component with support for horizontal and vertical layouts
 * https://dribbble.com/search/tabs
 */

import {
  claimWheelGesture,
  getScrollIntoViewScopedOffsets,
  releaseWheelGesture,
  scrollIntoViewScoped,
  wheelGestureIsTakenFrom,
} from "@jsenv/dom";
import { toChildArray } from "preact";
import { useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import {
  SLIDE_CURRENT_ATTRIBUTE,
  SLIDE_STATE_EVENT,
  SLIDE_TOWARD_ATTRIBUTE,
} from "../../layout/use_slide_container.js";
import { observeTransitionDestination } from "../transition_destination.js";
import { NavContext } from "./nav_context.js";

// A name of its own for the bar under the current tab, one per nav on the page:
// two bars answering to the same name are two elements claiming one picture,
// and the browser refuses the whole transition rather than pick.
let navCount = 0;
// Worn by a nav of routes while a route movement between two of its tabs is
// pictured (see markIndicatorTakesPart, and the CSS below for what it decides).
const BETWEEN_TABS_ATTRIBUTE = "data-nav-between-tabs";
// What one notch of a wheel that counts in LINES is worth on a row that counts
// in pixels. A rough line, deliberately: nothing here needs to agree with a
// paragraph, only to move the row about as far as a notch moves a page.
const WHEEL_LINE_SIZE = 16;

const css = /* css */ `
  @layer navi {
    .navi_nav {
      --nav-border: none;
      --nav-padding: 0px;
      --nav-border-radius: 0px;
      --nav-background: transparent;
      --nav-current-indicator-size: 2px;
      --nav-current-indicator-color: var(--navi-link-current-indicator-color);
    }
    /* What the row says about the bar reaches its tabs under the name a tab
       answers to, so the two natures of row take one declaration: the bar is
       drawn per tab in a row of routes and once for the whole row in a row of
       slides, and a caller colouring a tab should not have to know which.
       A tab that says otherwise for itself is what makes the bar arrive on it
       in its colour (see paintIndicatorGeometry). */
    .navi_nav .navi_link {
      --link-current-indicator-color: var(--nav-current-indicator-color);
    }
  }

  /* The bar of a nav whose tabs are SLIDES: one element for the whole row,
     placed over the current tab and interpolated towards the one the picture
     leans on (see paintIndicatorGeometry). The two ends are written in pixels
     as plain numbers, so the whole of the movement is a calc() the browser
     runs itself — the trait then follows a finger dragging the slides without a
     render per frame, and rides the same animation as the track when the travel
     was asked for rather than dragged.
     No named view transition here, unlike the bar of a nav made of routes:
     there is no transition to be part of — the slides travel under an animation
     of their own, which a finger can hold. */
  .navi_nav[data-nav-indicator] {
    position: relative;

    > .navi_nav_indicator {
      --x-nav-indicator-position: calc(
        var(--nav-indicator-position) + var(--slide-travel-progress) *
          var(--nav-indicator-position-delta)
      );
      --x-nav-indicator-length: calc(
        var(--nav-indicator-length) + var(--slide-travel-progress) *
          var(--nav-indicator-length-delta)
      );
      /* The colour of the two tabs the bar stands between, read off them and
         mixed at the very fraction the position is interpolated at: the trait
         changes colour AS IT TRAVELS, which is what belonging to the tab it is
         under means. The sign is the one the deltas above carry, so a fraction
         of zero — nothing to lean towards — is the current tab's colour alone.
         Both fall back to the row's when a tab has nothing of its own to say
         (see paintIndicatorGeometry: it writes nothing it could not read). */
      --x-nav-indicator-color: var(
        --nav-indicator-color,
        var(--nav-current-indicator-color)
      );
      --x-nav-indicator-color-toward: var(
        --nav-indicator-color-toward,
        var(--x-nav-indicator-color)
      );

      position: absolute;
      z-index: 1;
      background: color-mix(
        in srgb,
        var(--x-nav-indicator-color-toward)
          calc(
            var(--slide-travel-progress) * var(--nav-indicator-toward-sign, 0) *
              100%
          ),
        var(--x-nav-indicator-color)
      );
      border-radius: 0.1px;
      pointer-events: none;
    }
    /* Nothing to draw until the row has been measured: a tab bar whose current
       tab is not among its links (a container on a slide no tab names) has no
       place to put the trait. */
    &:not([data-nav-indicator-measured]) > .navi_nav_indicator {
      display: none;
    }

    &[data-nav-indicator="top"],
    &[data-nav-indicator="bottom"] {
      > .navi_nav_indicator {
        left: calc(var(--x-nav-indicator-position) * 1px);
        width: calc(var(--x-nav-indicator-length) * 1px);
        height: var(--nav-current-indicator-size);
      }
    }
    &[data-nav-indicator="top"] > .navi_nav_indicator {
      top: 0;
    }
    &[data-nav-indicator="bottom"] > .navi_nav_indicator {
      bottom: 0;
    }

    &[data-nav-indicator="left"],
    &[data-nav-indicator="right"] {
      > .navi_nav_indicator {
        top: calc(var(--x-nav-indicator-position) * 1px);
        width: var(--nav-current-indicator-size);
        height: calc(var(--x-nav-indicator-length) * 1px);
      }
    }
    &[data-nav-indicator="left"] > .navi_nav_indicator {
      left: 0;
    }
    &[data-nav-indicator="right"] > .navi_nav_indicator {
      right: 0;
    }
  }

  /* The bar under the current tab of a nav made of routes is NAMED: a change
     played as a view transition then finds it on both pictures and moves it
     from the tab it was under to the tab it is under, which is all "the bar
     slides" is. The name is the row's (--nav-indicator-name, absent when the
     row asked for no slide) and only the bar one can see wears it: every tab
     holds a bar, and a name belongs to one element at a time. */
  .navi_nav .navi_link[data-href-current] .navi_current_indicator {
    view-transition-name: var(--nav-indicator-name);
  }
  /* Named for a movement it takes part in, and for that alone. While the PAGES
     are the ones moving — a route transition, a route travel — a name lifts the
     bar out of its page's picture into a picture of its own, and a picture of
     its own is precisely what does not travel: it stands where it was captured,
     fading, while the row slides away under it. Right when the row is on both
     sides and the bar has a tab to glide to; wrong anywhere else, where the bar
     must leave or arrive with its row. So the name is dropped unless the
     movement goes from a tab of this row to another one of its tabs (see
     markIndicatorTakesPart). */
  :root:is([data-navi-route-transition], [data-navi-route-travel])
    .navi_nav:not([data-nav-between-tabs])
    .navi_current_indicator {
    view-transition-name: none;
  }

  .navi_nav {
    display: flex;
    width: fit-content;
    padding-top: var(
      --nav-padding-top,
      var(--nav-padding-y, var(--nav-padding, unset))
    );
    padding-right: var(
      --nav-padding-right,
      var(--nav-padding-x, var(--nav-padding, unset))
    );
    padding-bottom: var(
      --nav-padding-bottom,
      var(--nav-padding-y, var(--nav-padding, unset))
    );
    padding-left: var(
      --nav-padding-left,
      var(--nav-padding-x, var(--nav-padding, unset))
    );
    justify-content: stretch;
    background: var(--nav-background);
    border: var(--nav-border);
    border-radius: var(--nav-border-radius);
    /* A row asked to scroll is a row that does not get to decide its own
       width. fit-content above is what a nav is worth when nothing bounds it,
       and a row of tabs is worth all of them: nothing wraps, so its min-content
       IS its max-content, and fit-content resolves to the whole row however
       narrow the box around it. The scroller would then have nothing to
       scroll — a row hanging out of its container, clipped by whatever clips
       first. The ceiling is what makes the overflow real. */
    &[data-scrollable] {
      max-width: 100%;

      /* …and a row that does not decide its own width does not share it
         either: every tab keeps the size of its own label, does not shrink and
         does not wrap. Tabs at an equal share each is what makes an overflow
         impossible — ten of them always fit, so the row never scrolls and what
         one cannot read is every tab at once. Said here rather than on each
         tab: the row is the one that knows it may overflow.
         A tab that wants otherwise still says so for itself — a prop on the
         <Link> lands as an inline style, which wins over this. */
      .navi_link {
        flex: none;
        white-space: nowrap;
      }
    }
    &[data-scrollable][data-vertical] {
      max-height: 100%;
    }

    .navi_link {
      user-select: none;

      --x-nav-child-border-radius: calc(
        var(--nav-border-radius) - var(--nav-padding)
      );
      --x-nav-link-border-radius: var(
        --link-border-radius,
        var(--x-nav-child-border-radius)
      );

      &:first-child {
        border-top-left-radius: var(--x-nav-link-border-radius);
        border-bottom-left-radius: var(--x-nav-link-border-radius);
      }
      &:last-child {
        border-top-right-radius: var(--x-nav-link-border-radius);
        border-bottom-right-radius: var(--x-nav-link-border-radius);
      }
    }

    &[data-link-border-radius-inherit] {
      .navi_link {
        --link-border-radius: var(--x-nav-child-border-radius);
        border-top-left-radius: var(--link-border-radius);
        border-top-right-radius: var(--link-border-radius);
        border-bottom-right-radius: var(--link-border-radius);
        border-bottom-left-radius: var(--link-border-radius);
      }
    }

    /* A nav asked to expand is a nav whose tabs share it: one equal slice each,
       the label in the middle of the target that slice makes — a row that fills
       its container while its tabs sit at their text width stops in the middle,
       and gives every tab a different size to aim at.
       The main axis only: a vertical nav expanding horizontally fills the width
       (align-items below) rather than sharing its height between its tabs.
       The row itself still grows when it may overflow; only the sharing is off
       there, since a share of the row is a size that always fits (see
       [data-scrollable] above). */
    &[data-expand-x] {
      flex-grow: 1;

      &:not([data-vertical]):not([data-scrollable]) .navi_link {
        flex: 1;
        justify-content: center;
      }
    }
    &[data-expand-y][data-vertical]:not([data-scrollable]) {
      .navi_link {
        flex: 1;
      }
    }
    /* Vertical layout */
    &[data-vertical] {
      align-items: stretch;
    }

    /* Folder tabs: the current tab and the panel share one surface. Every tab
       carries the panel's line on the side facing it, and the current one
       paints that side with the panel background instead, so the line opens
       there. The negative margin makes the two lines overlap — without it the
       panel's own line would still be drawn under the tabs; and since a tab
       background is painted under its border too, a tab with a background of
       its own would otherwise hide the panel's line over its width.

       The line is 1px and never thicker: past that, the corner where a square
       tab meets the panel shows the miter as a visible notch. */
    &[data-panel-position] {
      --nav-border-color: transparent;
      --nav-tab-border-radius: 0px;

      --x-nav-panel-background: var(
        --nav-panel-background,
        var(--link-background-current, white)
      );

      position: relative;
      z-index: 1;

      .navi_link {
        border: 1px solid transparent;

        &[data-href-current] {
          border-color: var(--nav-border-color);
        }
      }

      &[data-panel-position="after"] {
        margin-bottom: -1px;

        .navi_link {
          border-bottom-color: var(--nav-border-color);

          &[data-href-current] {
            border-bottom-color: var(--x-nav-panel-background);
            border-top-left-radius: var(--nav-tab-border-radius);
            border-top-right-radius: var(--nav-tab-border-radius);
          }
        }
      }
      &[data-panel-position="before"] {
        margin-top: -1px;

        .navi_link {
          border-top-color: var(--nav-border-color);

          &[data-href-current] {
            border-top-color: var(--x-nav-panel-background);
            border-bottom-right-radius: var(--nav-tab-border-radius);
            border-bottom-left-radius: var(--nav-tab-border-radius);
          }
        }
      }
    }
  }
`;

const NavStyleCSSVars = {
  border: "--nav-border",
  borderRadius: "--nav-border-radius",
  padding: "--nav-padding",
  paddingX: "--nav-padding-x",
  paddingY: "--nav-padding-y",
  paddingTop: "--nav-padding-top",
  paddingRight: "--nav-padding-right",
  paddingBottom: "--nav-padding-bottom",
  paddingLeft: "--nav-padding-left",
  background: "--nav-background",
  currentIndicatorColor: "--nav-current-indicator-color",
  currentIndicatorSize: ["--nav-current-indicator-size", "height"],
};

const positionOfCurrentIndicator = (currentIndicator, vertical) => {
  if (currentIndicator === true) {
    return vertical ? "left" : "bottom";
  }
  if (
    currentIndicator === "top" ||
    currentIndicator === "bottom" ||
    currentIndicator === "left" ||
    currentIndicator === "right"
  ) {
    return currentIndicator;
  }
  return null;
};

/**
 * @type {import("preact").FunctionComponent<{
 *   currentIndicator?: boolean|"top"|"bottom"|"left"|"right",
 *   currentIndicatorSlides?: boolean,
 *   slideContainer?: string,
 * }>}
 * @param {boolean|"top"|"bottom"|"left"|"right"} [props.currentIndicator] - the
 *   bar that says which tab one is on, said once here rather than on every
 *   `<Link>`. A link may still say otherwise for itself.
 *   Its colour belongs to the tab it is under: `currentIndicatorColor` here is
 *   what every tab inherits, and a tab declaring
 *   `--nav-current-indicator-color` for itself is arrived at in its own colour
 *   — the bar changes colour as it travels rather than once it lands.
 * @param {boolean} [props.currentIndicatorSlides=true] - whether that bar
 *   travels from the tab it was under to the tab it is under now, instead of
 *   going out on one and coming back on the other. For a nav made of routes it
 *   does so by being NAMED, which is all the browser needs: any change played as
 *   a view transition animates it on the same clock as everything else in that
 *   transition. Inside a `RouteTravel` that means it follows the pages, and the
 *   thumb dragging them, without either of them being told about the other. It
 *   is named for a movement between two tabs of the row and for nothing else:
 *   when the pages move and the row is on one side only, the bar leaves or
 *   arrives with its row. For a nav made of slides (`slideContainer`) the bar
 *   is one element for the whole row, and it reads the travel the container
 *   publishes.
 * @param {string} [props.slideContainer] - the id of a `<SlideContainer>` these
 *   tabs are about: each one says which slide it is (`<Link slide="…">`), the
 *   container says which one is on screen, and pressing a tab travels there.
 *   Tabs that are places in the same screen rather than pages of their own —
 *   nothing is written to the URL and nothing is a link.
 */
export const Nav = ({
  children,
  spacing,
  vertical,
  expand,
  expandX,
  expandY,
  linkBorderRadiusInherit,
  currentIndicator,
  currentIndicatorSlides = true,
  panelPosition, // "before" or "after": which side the panel sits on, turning the nav into folder tabs
  slideContainer,
  ...props
}) => {
  import.meta.css = css;

  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const navRef = props.ref;
  const indicatorNameRef = useRef(null);
  if (indicatorNameRef.current === null) {
    indicatorNameRef.current = `navi-nav-indicator-${++navCount}`;
  }
  const [currentSlideArea, setCurrentSlideArea] = useState(undefined);
  const slideContainerElementRef = useRef(null);
  const indicatorPosition = slideContainer
    ? positionOfCurrentIndicator(currentIndicator, vertical)
    : null;

  // Which tab of this row is the one being shown: the slide the container says
  // it is on, or, for a row of routes, the link the browser is on.
  const getCurrentTabElement = () => {
    const navElement = navRef.current;
    if (!navElement) {
      return null;
    }
    const containerElement = slideContainerElementRef.current;
    if (!containerElement) {
      return navElement.querySelector("[data-href-current]");
    }
    const currentArea = containerElement.getAttribute(SLIDE_CURRENT_ATTRIBUTE);
    if (currentArea === null) {
      return null;
    }
    return navElement.querySelector(
      `[data-slide-target="${CSS.escape(currentArea)}"]`,
    );
  };
  // …and which one the picture leans on while it is not on the current one:
  // the slide a finger is pulling in, the slide an animation is leaving. There
  // is one only while a travel is playing.
  const getTowardTabElement = () => {
    const navElement = navRef.current;
    const containerElement = slideContainerElementRef.current;
    if (!navElement || !containerElement) {
      return null;
    }
    const towardArea = containerElement.getAttribute(SLIDE_TOWARD_ATTRIBUTE);
    if (towardArea === null) {
      return null;
    }
    return navElement.querySelector(
      `[data-slide-target="${CSS.escape(towardArea)}"]`,
    );
  };

  // Where the trait is, where it is headed, and in which colour at each end —
  // the numbers the CSS above interpolates between (see the .navi_nav_indicator
  // rules). Written by hand rather than rendered: it is read off the row as it
  // stands, and the travel it must agree with starts in the same frame the
  // container publishes it — a render would land after the movement had begun.
  const paintIndicatorGeometry = () => {
    const navElement = navRef.current;
    const containerElement = slideContainerElementRef.current;
    if (!navElement || !containerElement || !indicatorPosition) {
      return;
    }
    const tabElements = Array.from(
      navElement.querySelectorAll("[data-slide-target]"),
    );
    const areaOf = (tabElement) => tabElement.getAttribute("data-slide-target");
    const currentIndex = tabElements.indexOf(getCurrentTabElement());
    if (currentIndex === -1) {
      // On a slide no tab in this row names: there is no tab to sit under.
      navElement.removeAttribute("data-nav-indicator-measured");
      return;
    }
    const measure = (tabElement) =>
      vertical
        ? { position: tabElement.offsetTop, length: tabElement.offsetHeight }
        : { position: tabElement.offsetLeft, length: tabElement.offsetWidth };
    // The colour a tab asks the bar to be under it. Read from the tab and not
    // from the row, so a tab that says nothing gives the row's value back —
    // it inherits it (see the css above) — and one that says something gives
    // its own. Empty when neither resolves to anything: the css then falls
    // back on its own, rather than being handed a colour that is not one.
    const colorOf = (tabElement) =>
      getComputedStyle(tabElement)
        .getPropertyValue("--link-current-indicator-color")
        .trim();
    const writeColor = (property, color) => {
      if (color) {
        navElement.style.setProperty(property, color);
      } else {
        navElement.style.removeProperty(property);
      }
    };
    const currentMeasure = measure(tabElements[currentIndex]);
    const towardArea = containerElement.getAttribute(
      "data-slide-travel-toward",
    );
    const towardIndex = tabElements.findIndex(
      (tabElement) => areaOf(tabElement) === towardArea,
    );
    let positionDelta = 0;
    let lengthDelta = 0;
    let towardSign = 0;
    let towardColor = "";
    if (towardIndex !== -1 && towardIndex !== currentIndex) {
      const towardTabElement = tabElements[towardIndex];
      const towardMeasure = measure(towardTabElement);
      // What one box of travel is worth in pixels of this row, signed so that
      // the trait is exactly on the other tab when the progress is at its own
      // end: the container counts +1 when the picture leans on a slide sitting
      // BEFORE the current one and -1 when it sits after.
      const sign = towardIndex > currentIndex ? -1 : 1;
      positionDelta = (towardMeasure.position - currentMeasure.position) * sign;
      lengthDelta = (towardMeasure.length - currentMeasure.length) * sign;
      towardSign = sign;
      towardColor = colorOf(towardTabElement);
    }
    const { style } = navElement;
    style.setProperty("--nav-indicator-position", currentMeasure.position);
    style.setProperty("--nav-indicator-length", currentMeasure.length);
    style.setProperty("--nav-indicator-position-delta", positionDelta);
    style.setProperty("--nav-indicator-length-delta", lengthDelta);
    style.setProperty("--nav-indicator-toward-sign", towardSign);
    writeColor("--nav-indicator-color", colorOf(tabElements[currentIndex]));
    writeColor("--nav-indicator-color-toward", towardColor);
    navElement.setAttribute("data-nav-indicator-measured", "");
  };
  // Reached through a ref by everything watching the DOM below: those watchers
  // outlive a render, and what they must run is the version of this that knows
  // about the row as it is now.
  const paintIndicatorGeometryRef = useRef(null);
  paintIndicatorGeometryRef.current = paintIndicatorGeometry;

  // A row of tabs wider than the box holding it scrolls (the caller asks for
  // that with overflowX) — and then saying which tab one is on is not enough,
  // that tab must be somewhere one can see. The trait needs nothing here: it
  // is placed with offsetLeft, inside the row, so it rides along.
  // The ROW is what gets scrolled, never the tab: element.scrollIntoView()
  // walks every scrolling ancestor it finds, and a tab row lives in sheets
  // that sit on pages that scroll — bringing a tab into sight must move the
  // row and nothing else.
  const tabInSightRef = useRef(null);
  const keepCurrentTabInSight = () => {
    const navElement = navRef.current;
    const currentTabElement = getCurrentTabElement();
    // Brought into sight once, and then left where it is: the row scrolls, so
    // the user may have pushed it elsewhere since to read the other tabs, and
    // a render that changed none of this has no business taking that back.
    if (currentTabElement === tabInSightRef.current) {
      return;
    }
    tabInSightRef.current = currentTabElement;
    if (!currentTabElement) {
      return;
    }
    scrollIntoViewScoped(currentTabElement, { container: navElement });
  };

  // …and while a travel is playing the row gets there AT THE PACE OF THE
  // TRAVEL, off the very number the trait is drawn from: the container
  // publishes how far between the two slides the picture stands
  // (--slide-travel-progress, written on this row — see followerElements), and
  // the row is scrolled the same fraction of the way between the two tabs. The
  // slides gliding while the tabs jump at the end is one movement told twice.
  //
  // Read frame by frame, because that number is nobody's news: under a finger
  // the container writes it per frame with no announcement (a write is not a
  // change), and for a travel that was asked for it is the browser that
  // animates it. So the row samples it, exactly as the trait does — except that
  // a scroll offset is not a thing CSS can be handed.
  const travelScrollRef = useRef(null);
  const syncTabScroll = ({ afterAFrame } = {}) => {
    const navElement = navRef.current;
    if (!navElement) {
      return;
    }
    const currentTabElement = getCurrentTabElement();
    const towardTabElement = getTowardTabElement();
    if (!currentTabElement || !towardTabElement) {
      travelScrollRef.current = null;
      // Nothing is travelling — but a travel that was ASKED for is announced a
      // breath after the slide it lands on, so a row that lands the moment the
      // current tab changes lands ahead of the movement it should have ridden,
      // and the slides then glide towards a row already there. Giving it a
      // frame costs nothing: the slides have not moved either.
      // Only for a row of slides, and only once — a row of routes has no travel
      // to ride, and the second look is the one that lands.
      if (
        slideContainer &&
        !afterAFrame &&
        tabInSightRef.current &&
        tabInSightRef.current !== currentTabElement
      ) {
        scheduleTabScrollSync({ nextFrame: true });
        return;
      }
      // Nowhere between: the row lands where it belongs.
      keepCurrentTabInSight();
      return;
    }
    let travel = travelScrollRef.current;
    if (
      !travel ||
      travel.from !== currentTabElement ||
      travel.toward !== towardTabElement
    ) {
      // The two ends, measured once for this travel: measuring them again on a
      // row that has since moved would be measuring from the answer.
      const fromOffsets = getScrollIntoViewScopedOffsets(currentTabElement, {
        container: navElement,
      });
      const towardOffsets = getScrollIntoViewScopedOffsets(towardTabElement, {
        container: navElement,
      });
      // Signed the way the container counts: +1 when the picture leans on a
      // slide sitting BEFORE the current one, -1 when it sits after — the same
      // reading paintIndicatorGeometry does of the same number.
      const sign =
        currentTabElement.compareDocumentPosition(towardTabElement) &
        Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1;
      travel = {
        from: currentTabElement,
        toward: towardTabElement,
        left: fromOffsets.left,
        top: fromOffsets.top,
        leftDelta: (towardOffsets.left - fromOffsets.left) * sign,
        topDelta: (towardOffsets.top - fromOffsets.top) * sign,
      };
      travelScrollRef.current = travel;
    }
    const progress =
      parseFloat(
        getComputedStyle(navElement).getPropertyValue(
          "--slide-travel-progress",
        ),
      ) || 0;
    navElement.scrollTo({
      left: travel.left + progress * travel.leftDelta,
      top: travel.top + progress * travel.topDelta,
      // The row is being driven frame by frame: a caller who asked for smooth
      // scrolling asked it of a scroll that lands, not of one that is held.
      behavior: "instant",
    });
    scheduleTabScrollSync({ nextFrame: true });
  };
  const syncTabScrollRef = useRef(null);
  syncTabScrollRef.current = syncTabScroll;

  // When to look: on the next frame while a travel is being followed, and
  // otherwise at the end of the current task. A MICROTASK and not a frame,
  // because the two are told apart in the same breath — a travel that was
  // asked for announces the slide it lands on before it announces the one it
  // is leaving, so a row settling straight away would jump to the destination
  // and only then be asked to travel there. And it is still before the paint,
  // which a frame is not: a row that opens on a far tab must be scrolled
  // already the first time it is seen.
  const syncScheduledRef = useRef(false);
  const syncFrameRef = useRef(0);
  const scheduleTabScrollSync = ({ nextFrame } = {}) => {
    if (syncScheduledRef.current) {
      return;
    }
    syncScheduledRef.current = true;
    const run = () => {
      syncScheduledRef.current = false;
      syncFrameRef.current = 0;
      syncTabScrollRef.current({ afterAFrame: nextFrame });
    };
    if (nextFrame) {
      syncFrameRef.current = requestAnimationFrame(run);
    } else {
      queueMicrotask(run);
    }
  };
  const scheduleTabScrollSyncRef = useRef(null);
  scheduleTabScrollSyncRef.current = scheduleTabScrollSync;
  useLayoutEffect(() => {
    return () => {
      cancelAnimationFrame(syncFrameRef.current);
    };
  }, []);

  // The row watches its own size and reads itself again when it changes — a
  // badge count, a font that just arrived, a window resized: what was written
  // is pixels, where the trait sits and how far the row is scrolled, and
  // pixels measured on a row of another width are wrong. A row that had no
  // width at all is the same story with a sharper edge: inside a closed
  // <dialog> everything measures 0, and the current tab does not change when
  // the dialog opens, so nothing else would ever look again.
  // A scroll takes no size from anything, so this stays quiet while the row is
  // being pushed around by hand.
  useLayoutEffect(() => {
    const sizeObserver = new ResizeObserver(() => {
      paintIndicatorGeometryRef.current();
      // What was brought into sight was brought there for another row.
      tabInSightRef.current = null;
      scheduleTabScrollSyncRef.current();
    });
    sizeObserver.observe(navRef.current);
    return () => {
      sizeObserver.disconnect();
    };
  }, []);

  // A row that scrolls sideways, and a mouse that only turns one way. A
  // vertical wheel is left to the vertical axis, which a row of tabs does not
  // have: the push goes past the row to the page, and the tabs stay where they
  // were — a row a trackpad can push around and a mouse cannot reach at all.
  // Up and further along are the same wish here, so the push moves the row.
  // Only for a row that scrolls on ONE axis: one that scrolls the way the
  // wheel turns already has the answer it wants, and taking the push would be
  // answering it twice.
  useLayoutEffect(() => {
    const navElement = navRef.current;
    const onWheel = (wheelEvent) => {
      // The burst is already somebody else's — a box travelling under the
      // pointer, a wheel picker — and stays theirs until it dies out, wherever
      // the pointer has drifted since (see wheel_gesture.js).
      if (wheelGestureIsTakenFrom(navElement)) {
        return;
      }
      const { deltaX, deltaY } = wheelEvent;
      if (Math.abs(deltaY) <= Math.abs(deltaX)) {
        // Sideways already: the browser knows where to put it.
        return;
      }
      const scrollableWidth = navElement.scrollWidth - navElement.clientWidth;
      const scrollableHeight =
        navElement.scrollHeight - navElement.clientHeight;
      if (scrollableWidth <= 0 || scrollableHeight > 0) {
        return;
      }
      // Not every wheel speaks in pixels: some count lines, some count pages.
      const notch =
        wheelEvent.deltaMode === 1
          ? WHEEL_LINE_SIZE
          : wheelEvent.deltaMode === 2
            ? navElement.clientWidth
            : 1;
      const scrollLeftBefore = navElement.scrollLeft;
      const scrollLeftWanted = Math.max(
        0,
        Math.min(scrollableWidth, scrollLeftBefore + deltaY * notch),
      );
      if (scrollLeftWanted === scrollLeftBefore) {
        // The row is at its end and the hand is still pushing: what is left
        // over is the page's, exactly as it would have been without any of
        // this.
        return;
      }
      wheelEvent.preventDefault();
      claimWheelGesture(navElement);
      navElement.scrollLeft = scrollLeftWanted;
    };
    navElement.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      navElement.removeEventListener("wheel", onWheel);
      releaseWheelGesture(navElement);
    };
  }, []);

  useLayoutEffect(() => {
    if (!slideContainer) {
      return undefined;
    }
    const containerElement = document.getElementById(slideContainer);
    if (!containerElement) {
      console.warn(
        `<Nav slideContainer="${slideContainer}"> but no element with that id found`,
      );
      return undefined;
    }
    slideContainerElementRef.current = containerElement;
    const readContainer = () => {
      setCurrentSlideArea(
        containerElement.getAttribute(SLIDE_CURRENT_ATTRIBUTE) ?? undefined,
      );
      paintIndicatorGeometryRef.current();
      scheduleTabScrollSyncRef.current();
    };
    readContainer();
    // Where one is and what the picture leans on are written on the container,
    // and the container says out loud when either has changed: this row is not
    // in the box (it sits above it, in a fixed bar, anywhere), so it reads the
    // first and listens to the second. Listening rather than watching the DOM
    // because a write is not a change — the attribute the trait follows is
    // written on every frame of a gesture with the same value in it.
    containerElement.addEventListener(SLIDE_STATE_EVENT, readContainer);
    return () => {
      containerElement.removeEventListener(SLIDE_STATE_EVENT, readContainer);
      slideContainerElementRef.current = null;
    };
  }, [slideContainer]);

  // Said after every commit: a tab added, removed or renamed moves the trait,
  // and no observer above watches this row's own children.
  useLayoutEffect(() => {
    paintIndicatorGeometry();
    scheduleTabScrollSync();
  });

  // Whether the bar keeps its name for the route movement about to be pictured
  // (see the CSS above). Written on the DOM as the movement is announced rather
  // than rendered: rendering is held from a navigation's first word until the
  // movement's first picture is taken (see rendering_hold.js), so a render
  // would land on the second picture with the first already taken.
  useLayoutEffect(() => {
    const navElement = navRef.current;
    const markIndicatorTakesPart = (destinationUrl) => {
      if (destinationUrl === null) {
        navElement.removeAttribute(BETWEEN_TABS_ATTRIBUTE);
        return;
      }
      // From a tab of this row: the row still shows the page being left, and
      // the tab it is on. To a tab of this row: one of its links aims at the
      // page the movement goes to. A row mounted while the movement plays hears
      // nothing here and stays unnamed, rightly: its bar is on the second
      // picture alone, with nothing on the first to glide from.
      const fromTab = navElement.querySelector("[data-href-current]");
      let toTab = null;
      for (const linkElement of navElement.querySelectorAll("a[href]")) {
        if (linkElement.href === destinationUrl) {
          toTab = linkElement;
          break;
        }
      }
      if (fromTab && toTab) {
        navElement.setAttribute(BETWEEN_TABS_ATTRIBUTE, "");
      } else {
        navElement.removeAttribute(BETWEEN_TABS_ATTRIBUTE);
      }
    };
    return observeTransitionDestination(markIndicatorTakesPart);
  }, []);

  const navContextValue = useMemo(
    () => ({
      // The bar belongs to the row itself when the tabs are slides, so the
      // links draw none of their own.
      currentIndicator: slideContainer ? undefined : currentIndicator,
      slideContainer,
      currentSlideArea,
    }),
    [currentIndicator, slideContainer, currentSlideArea],
  );

  children = toChildArray(children);

  return (
    <Box
      as="nav"
      row={vertical}
      column={!vertical}
      baseClassName="navi_nav"
      data-link-border-radius-inherit={linkBorderRadiusInherit ? "" : undefined}
      data-expand-x={expand || expandX ? "" : undefined}
      data-expand-y={expand || expandY ? "" : undefined}
      data-vertical={vertical ? "" : undefined}
      data-panel-position={panelPosition}
      data-nav-indicator={indicatorPosition ?? undefined}
      // "write your travel here too": a custom property cannot be read across
      // the DOM, so the container paints its progress onto this element and the
      // trait follows in CSS alone (see SlideContainer's followerElements).
      data-slide-container-follows={slideContainer}
      // Tabs over one screen, not links to pages: a screen reader is told so,
      // and told which way the row runs.
      role={slideContainer ? "tablist" : undefined}
      aria-orientation={slideContainer && vertical ? "vertical" : undefined}
      expand={expand}
      expandX={expandX}
      expandY={expandY}
      spacing={spacing}
      {...props}
      // The name the bar of the current tab wears, handed to the CSS above
      // rather than to the links: which bar wears it, and when, is decided
      // there.
      style={
        currentIndicatorSlides && !slideContainer
          ? { ...props.style, "--nav-indicator-name": indicatorNameRef.current }
          : props.style
      }
      styleCSSVars={NavStyleCSSVars}
    >
      {indicatorPosition && <span className="navi_nav_indicator" />}
      <NavContext.Provider value={navContextValue}>
        {children}
      </NavContext.Provider>
    </Box>
  );
};
