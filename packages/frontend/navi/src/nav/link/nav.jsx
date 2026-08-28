/**
 * TabList component with support for horizontal and vertical layouts
 * https://dribbble.com/search/tabs
 */

import { toChildArray } from "preact";
import { useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { observeTransitionDestination } from "../transition_destination.js";
import { NavContext } from "./nav_context.js";

// A name of its own for the bar under the current tab, one per nav on the page:
// two bars answering to the same name are two elements claiming one picture,
// and the browser refuses the whole transition rather than pick.
let navCount = 0;
// Worn by a nav of routes while a route movement between two of its tabs is
// pictured (see markIndicatorTakesPart, and the CSS below for what it decides).
const BETWEEN_TABS_ATTRIBUTE = "data-nav-between-tabs";

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

      position: absolute;
      z-index: 1;
      background: var(--nav-current-indicator-color);
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
    .navi_nav:not([${BETWEEN_TABS_ATTRIBUTE}])
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
    /* overflow-x: auto; */
    /* overflow-y: hidden; */

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
       (align-items below) rather than sharing its height between its tabs. */
    &[data-expand-x] {
      flex-grow: 1;

      &:not([data-vertical]) .navi_link {
        flex: 1;
        justify-content: center;
      }
    }
    &[data-expand-y][data-vertical] {
      .navi_link {
        flex: 1;
      }
    }
    /* Vertical layout */
    &[data-vertical] {
      /* overflow-x: hidden; */
      /* overflow-y: auto; */
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
  currentIndicatorSize: "--nav-current-indicator-size",
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

  // Where the trait is and where it is headed, as four numbers of pixels the
  // CSS above interpolates between (see the .navi_nav_indicator rules). Written
  // by hand rather than rendered: it is read off the row as it stands, and the
  // travel it must agree with starts in the same frame the container publishes
  // it — a render would land after the movement had begun.
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
    const currentArea = containerElement.getAttribute("data-slide-current");
    const currentIndex = tabElements.findIndex(
      (tabElement) => areaOf(tabElement) === currentArea,
    );
    if (currentIndex === -1) {
      // On a slide no tab in this row names: there is no tab to sit under.
      navElement.removeAttribute("data-nav-indicator-measured");
      return;
    }
    const measure = (tabElement) =>
      vertical
        ? { position: tabElement.offsetTop, length: tabElement.offsetHeight }
        : { position: tabElement.offsetLeft, length: tabElement.offsetWidth };
    const currentMeasure = measure(tabElements[currentIndex]);
    const towardArea = containerElement.getAttribute(
      "data-slide-travel-toward",
    );
    const towardIndex = tabElements.findIndex(
      (tabElement) => areaOf(tabElement) === towardArea,
    );
    let positionDelta = 0;
    let lengthDelta = 0;
    if (towardIndex !== -1 && towardIndex !== currentIndex) {
      const towardMeasure = measure(tabElements[towardIndex]);
      // What one box of travel is worth in pixels of this row, signed so that
      // the trait is exactly on the other tab when the progress is at its own
      // end: the container counts +1 when the picture leans on a slide sitting
      // BEFORE the current one and -1 when it sits after.
      const sign = towardIndex > currentIndex ? -1 : 1;
      positionDelta = (towardMeasure.position - currentMeasure.position) * sign;
      lengthDelta = (towardMeasure.length - currentMeasure.length) * sign;
    }
    const { style } = navElement;
    style.setProperty("--nav-indicator-position", currentMeasure.position);
    style.setProperty("--nav-indicator-length", currentMeasure.length);
    style.setProperty("--nav-indicator-position-delta", positionDelta);
    style.setProperty("--nav-indicator-length-delta", lengthDelta);
    navElement.setAttribute("data-nav-indicator-measured", "");
  };
  // Reached through a ref by everything watching the DOM below: those watchers
  // outlive a render, and what they must run is the version of this that knows
  // about the row as it is now.
  const paintIndicatorGeometryRef = useRef(null);
  paintIndicatorGeometryRef.current = paintIndicatorGeometry;

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
        containerElement.getAttribute("data-slide-current") ?? undefined,
      );
      paintIndicatorGeometryRef.current();
    };
    readContainer();
    // The container says where one is and what the picture leans on, and says
    // it in the DOM: nothing here is told, everything is read — which is what
    // lets this row sit anywhere on the page (above the box, in a fixed bar)
    // rather than inside it.
    const attributeObserver = new MutationObserver(readContainer);
    attributeObserver.observe(containerElement, {
      attributes: true,
      attributeFilter: ["data-slide-current", "data-slide-travel-toward"],
    });
    // A row whose tabs changed width — a badge count, a font that just
    // arrived, a window resized — is measured again: what was written is
    // pixels, and pixels go stale.
    const sizeObserver = new ResizeObserver(() => {
      paintIndicatorGeometryRef.current();
    });
    sizeObserver.observe(navRef.current);
    return () => {
      attributeObserver.disconnect();
      sizeObserver.disconnect();
      slideContainerElementRef.current = null;
    };
  }, [slideContainer]);

  // Said after every commit: a tab added, removed or renamed moves the trait,
  // and no observer above watches this row's own children.
  useLayoutEffect(() => {
    paintIndicatorGeometry();
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
