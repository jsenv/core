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
import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { Box } from "../../box/box.jsx";
import {
  readSlideOnScreen,
  SLIDE_BASE_ATTRIBUTE,
  SLIDE_CURRENT_ATTRIBUTE,
  SLIDE_STATE_EVENT,
  SLIDE_TOWARD_ATTRIBUTE,
} from "../../layout/use_slide_container.js";
import { pageIsAt } from "../route_page.js";
import { RoutePageContext } from "../route_page_context.js";
import { followRouteRows } from "../route_row_follow.js";
import { observeTransitionDestination } from "../transition_destination.js";
import { NavContext } from "./nav_context.js";

// A name of its own for the bar under the current tab, one per nav on the page:
// two bars answering to the same name are two elements claiming one picture,
// and the browser refuses the whole transition rather than pick.
let navCount = 0;
// Worn by a nav of routes while a route movement between two of its tabs is
// pictured (see markIndicatorTakesPart, and the CSS below for what it decides).
const BETWEEN_TABS_ATTRIBUTE = "data-nav-between-tabs";
// Worn by the one tab of a nav of routes whose bar wears the row's name (see
// nameIndicatorTab).
const NAMED_TAB_ATTRIBUTE = "data-nav-named-tab";

// The tabs of this row the address is on, in the order they stand: its own,
// not those of a nav nested in it, which answers for its own.
const currentTabsOf = (navElement) => {
  const currentTabs = [];
  for (const element of navElement.querySelectorAll("[data-href-current]")) {
    if (element.closest(".navi_nav") === navElement) {
      currentTabs.push(element);
    }
  }
  return currentTabs;
};
// What one notch of a wheel that counts in LINES is worth on a row that counts
// in pixels. A rough line, deliberately: nothing here needs to agree with a
// paragraph, only to move the row about as far as a notch moves a page.
const WHEEL_LINE_SIZE = 16;

// The animation a slide container puts on this row to bring the travel's
// progress home (see animateTravelProgress in slide_container.jsx) — the cheap
// source of that number while a travel plays (see syncTabScroll). Its starting
// value is read off the keyframes here, once: the frame loop only ever asks
// the animation how far along it is.
const rememberProgressAnimation = (navElement, travel) => {
  const animation = navElement.getAnimations().find((candidate) => {
    const keyframes = candidate.effect?.getKeyframes?.();
    return keyframes?.[0] && "--slide-travel-progress" in keyframes[0];
  });
  travel.progressAnimation = animation;
  travel.progressFrom = animation
    ? parseFloat(
        animation.effect.getKeyframes()[0]["--slide-travel-progress"],
      ) || 0
    : 0;
};

const css = /* css */ `
  @layer navi {
    .navi_nav {
      --nav-width: fit-content;
      --nav-border: none;
      --nav-padding: 0px;
      --nav-border-radius: 0px;
      --nav-background: transparent;
      --nav-current-indicator-size: 2px;
      --nav-current-indicator-color: var(--navi-link-current-indicator-color);
    }
    /* What the row says about the bar, its colour and its thickness, reaches
       its tabs under the name a tab answers to, so the two natures of row take
       one declaration: the bar is drawn per tab in a row of routes (and once
       for the whole row while it follows a RouteTravel), once for the whole
       row in a row of slides, and a caller colouring a tab should not have to
       know which. A tab that says otherwise for itself is what makes the bar
       arrive on it in its colour (see paintIndicatorGeometry). */
    .navi_nav .navi_link {
      --link-current-indicator-color: var(--nav-current-indicator-color);
      --link-current-indicator-size: var(--nav-current-indicator-size);
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
      /* One step above a focused tab (link.jsx raises it to 1): the bar says
         where you are, and the tab you just pressed must not hide it. */
      z-index: 2;
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

  /* A row of routes the browser scrolls has no transition to name the bar for:
     for as long as it moves, the bar of the whole row above is drawn and the one
     under each tab stands aside (see followRouteRows). */
  .navi_nav[data-nav-following-row] .navi_current_indicator {
    visibility: hidden;
  }

  /* The bar under the current tab of a nav made of routes is NAMED: a change
     played as a view transition then finds it on both pictures and moves it
     from the tab it was under to the tab it is under, which is all "the bar
     slides" is. The name is the row's (--nav-indicator-name, "none" when the
     row asked for no slide) and only the bar of the tab the row chose wears it
     (see nameIndicatorTab): every tab holds a bar, two of them can be current
     at once, and a name belongs to one element at a time — worn twice, the
     browser refuses the whole transition. */
  .navi_nav
    .navi_link[data-href-current][data-nav-named-tab]
    .navi_current_indicator {
    view-transition-name: var(--nav-indicator-name);
  }
  /* Unnamed for a route movement it takes no part in. While the PAGES are the
     ones moving, a name lifts the bar out of its page's picture into a picture
     of its own, and a picture of its own is precisely what does not travel: it
     stands where it was captured, fading, while the row slides away under it.
     Right when the row is on both sides and the bar has a tab to glide to;
     wrong anywhere else, where the bar must leave or arrive with its row. So
     the name is dropped unless the movement goes from a tab of this row to
     another one of its tabs, in a row still shown where the movement goes (see
     markIndicatorTakesPart). */
  :root[data-navi-route-transition]
    .navi_nav:not([data-nav-between-tabs])
    .navi_current_indicator {
    view-transition-name: none;
  }

  .navi_nav {
    display: flex;
    width: var(--nav-width);
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
       width. fit-content (--nav-width) is what a nav is worth when nothing
       bounds it, and a row of tabs is worth all of them: nothing wraps, so its
       min-content IS its max-content, and fit-content resolves to the whole
       row however narrow the box around it. The scroller would then have
       nothing to scroll — a row hanging out of its container, clipped by
       whatever clips first. The ceiling is what makes the overflow real. */
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

      /* Counted among the links only: a slide Nav writes its bar before them. */
      &:nth-child(1 of .navi_link) {
        border-top-left-radius: var(--x-nav-link-border-radius);
        border-bottom-left-radius: var(--x-nav-link-border-radius);
      }
      &:nth-last-child(1 of .navi_link) {
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
       The sharing only: how the row itself takes the space is the expandX/expandY
       prop's answer on the Box, which is the one that knows whether the parent
       runs in that direction (filling the width of a column parent and growing
       inside a row parent are two different declarations).
       The main axis only: a vertical nav expanding horizontally fills the width
       (align-items below) rather than sharing its height between its tabs.
       And a row that may overflow shares nothing: a share of the row is a size
       that always fits, so there would be no overflow left to scroll (see
       [data-scrollable] above). */
    &[data-expand-x]:not([data-vertical]):not([data-scrollable]) {
      .navi_link {
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

// Where the bar is, where it is headed and in which colour at each end: the
// numbers the CSS above interpolates between. Measured off the DOM (offsets force
// a layout, the colours a style resolve), so asked only when the two tabs change.
const writeIndicatorGeometry = (
  navElement,
  { baseTabElement, towardTabElement, towardIsAfter, vertical },
) => {
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
  const baseMeasure = measure(baseTabElement);
  let positionDelta = 0;
  let lengthDelta = 0;
  let towardSign = 0;
  let towardColor = "";
  if (towardTabElement) {
    const towardMeasure = measure(towardTabElement);
    // What one box of travel is worth in pixels of this row, signed so that
    // the trait is exactly on the other tab when the progress is at its own
    // end: the container counts +1 when the picture leans on a slide sitting
    // BEFORE the current one and -1 when it sits after.
    const sign = towardIsAfter ? -1 : 1;
    positionDelta = (towardMeasure.position - baseMeasure.position) * sign;
    lengthDelta = (towardMeasure.length - baseMeasure.length) * sign;
    towardSign = sign;
    towardColor = colorOf(towardTabElement);
  }
  const { style } = navElement;
  style.setProperty("--nav-indicator-position", baseMeasure.position);
  style.setProperty("--nav-indicator-length", baseMeasure.length);
  style.setProperty("--nav-indicator-position-delta", positionDelta);
  style.setProperty("--nav-indicator-length-delta", lengthDelta);
  style.setProperty("--nav-indicator-toward-sign", towardSign);
  writeColor("--nav-indicator-color", colorOf(baseTabElement));
  writeColor("--nav-indicator-color-toward", towardColor);
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
 *   panelPosition?: "before"|"after",
 * }>}
 * @param {boolean|"top"|"bottom"|"left"|"right"} [props.currentIndicator] - the
 *   bar that says which tab one is on, said once here rather than on every
 *   `<Link>`. A link may still say otherwise for itself. `true` is
 *   `"bottom"`, or `"left"` for a `vertical` row. Resolved here once, with `currentIndicatorSize`, for every bar the row
 *   draws: the one under each tab and the one drawn for the whole row while it
 *   follows a hand.
 *   Its colour belongs to the tab it is under: `currentIndicatorColor` here is
 *   what every tab inherits, and a tab declaring
 *   `--nav-current-indicator-color` for itself is arrived at in its own colour
 *   — the bar changes colour as it travels rather than once it lands.
 * @param {boolean} [props.currentIndicatorSlides=true] - whether that bar
 *   travels from the tab it was under to the tab it is under now, instead of
 *   jumping. For a nav made of routes:
 *   - under a hand moving a `RouteTravel` row, the bar follows the hand between
 *     the tabs of the two pages the row stands between — a tab is a page when
 *     its address is that page's, search params it names included, the reading
 *     RouteTravel itself makes of a pressed link;
 *   - for a change played as a route transition, the bar is NAMED, which is all
 *     the browser needs to move it on the same clock as everything else. It
 *     keeps the name only for a movement between two tabs of a row that is on
 *     both sides: outside any route, or in a page the movement keeps on screen.
 *     A row each page renders for itself is another row on the other side, and
 *     its bar leaves with its page. One tab wears the name, the first current
 *     one: two current tabs (a frame tab whose route covers the address of its
 *     child) draw two bars, of which only the first glides, and are warned
 *     about in dev. Any other view transition finds that bar named, a picture
 *     of its own.
 *   `false`: none of this, the bar jumps. For a nav made of slides
 *   (`slideContainer`) the bar is one element for the whole row and always
 *   reads the travel the container publishes: this prop does not apply.
 *
 *   A row that scrolls (`overflowX`) brings its current tab into sight when it
 *   changes — a press, Back, a hand on a `RouteTravel` — and when the row
 *   changes size, never on a plain render: a row pushed by hand to read the
 *   other tabs stays where it was pushed.
 * @param {string} [props.slideContainer] - the id of a `<SlideContainer>` these
 *   tabs are about: each one says which slide it is (`<Link slide="…">`), the
 *   container says which one is on screen, and pressing a tab travels there.
 *   Tabs that are places in the same screen rather than pages of their own —
 *   nothing is written to the URL and nothing is a link.
 * @param {"before"|"after"} [props.panelPosition] - turns the row into folder
 *   tabs: the current tab and the panel it opens share one surface, and this
 *   says which side of the row the panel sits on.
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
  // Where the bar goes, resolved once for every bar this row draws: the row's
  // own for slides, the one under each tab for routes (handed to the links
  // through NavContext), and the row's own again while a row of routes follows
  // a hand.
  const resolvedIndicatorPosition = positionOfCurrentIndicator(
    currentIndicator,
    vertical,
  );
  const indicatorPosition = slideContainer ? resolvedIndicatorPosition : null;
  const rowIndicatorPosition = slideContainer
    ? null
    : resolvedIndicatorPosition;
  const followsRouteRows =
    Boolean(rowIndicatorPosition) && currentIndicatorSlides;
  // The page this row is rendered in, if any: whether it is still on screen
  // where a route movement goes is what says whether the row survives it (see
  // markIndicatorTakesPart).
  const routePage = useContext(RoutePageContext);
  const routePageRef = useRef(null);
  routePageRef.current = routePage;

  // Which tab of this row is the one being shown: the slide the container says
  // it is on, or, for a row of routes, the first link the browser is on.
  const getCurrentTabElement = () => {
    const navElement = navRef.current;
    if (!navElement) {
      return null;
    }
    const containerElement = slideContainerElementRef.current;
    if (!containerElement) {
      return currentTabsOf(navElement)[0] ?? null;
    }
    // The tab the trait counts from: the current one, unless a hand has carried
    // the row past it.
    const currentArea =
      containerElement.getAttribute(SLIDE_BASE_ATTRIBUTE) ??
      containerElement.getAttribute(SLIDE_CURRENT_ATTRIBUTE);
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
      indicatorPaintedForRef.current = null;
      return;
    }
    // Everything below is measured off the DOM (offsets force a layout, the
    // colours a style resolve), and what it depends on is exactly two facts:
    // which tab is current and which one the travel leans toward. A travel
    // announces its state several times between those two changing — painted
    // each time, the same measurement is paid again on frames the travel is
    // drawn on. The size observer clears the memo, since the same pair
    // measures differently once the row or a tab has another size.
    const towardAreaNow = containerElement.getAttribute(
      "data-slide-travel-toward",
    );
    const paintedFor = indicatorPaintedForRef.current;
    if (
      paintedFor &&
      paintedFor.currentTabElement === tabElements[currentIndex] &&
      paintedFor.towardArea === towardAreaNow &&
      paintedFor.tabCount === tabElements.length &&
      paintedFor.vertical === vertical
    ) {
      return;
    }
    indicatorPaintedForRef.current = {
      currentTabElement: tabElements[currentIndex],
      towardArea: towardAreaNow,
      tabCount: tabElements.length,
      vertical,
    };
    const towardIndex = tabElements.findIndex(
      (tabElement) => areaOf(tabElement) === towardAreaNow,
    );
    writeIndicatorGeometry(navElement, {
      baseTabElement: tabElements[currentIndex],
      towardTabElement:
        towardIndex !== -1 && towardIndex !== currentIndex
          ? tabElements[towardIndex]
          : null,
      towardIsAfter: towardIndex > currentIndex,
      vertical,
    });
    navElement.setAttribute("data-nav-indicator-measured", "");
  };
  // Reached through a ref by everything watching the DOM below: those watchers
  // outlive a render, and what they must run is the version of this that knows
  // about the row as it is now.
  const paintIndicatorGeometryRef = useRef(null);
  paintIndicatorGeometryRef.current = paintIndicatorGeometry;

  // The bar following a row of routes the browser scrolls, between the tabs of
  // the two pages it stands between. A tab is a page when its address is that
  // page's (pageIsAt): the reading RouteTravel makes of a pressed link, so
  // pages told apart by a search param are told apart here too. A row this nav
  // holds no tab for is another nav's to draw.
  // The pages a row publishes stay the same objects for as long as it moves,
  // so which tabs they are is looked up when they change, not at every scroll.
  const followedRef = useRef(null);
  useLayoutEffect(() => {
    if (!followsRouteRows) {
      return undefined;
    }
    const letGo = () => {
      const navElement = navRef.current;
      navElement?.removeAttribute("data-nav-following-row");
      navElement?.removeAttribute("data-nav-indicator-measured");
      navElement?.style.removeProperty("--slide-travel-progress");
    };
    const stopFollowing = followRouteRows((row, move) => {
      const navElement = navRef.current;
      if (!navElement) {
        return;
      }
      let followed = followedRef.current;
      // Following a row whose tabs are this nav's: what another row says —
      // that it moves, that it stopped — is about other tabs.
      const followingAnother =
        followed && followed.row !== row && followed.baseTabElement;
      if (!move) {
        if (followed && followed.row === row) {
          followedRef.current = null;
          letGo();
        }
        return;
      }
      if (followingAnother) {
        return;
      }
      if (
        !followed ||
        followed.row !== row ||
        followed.basePage !== move.basePage ||
        followed.towardPage !== move.towardPage
      ) {
        const tabElements = Array.from(
          navElement.querySelectorAll(".navi_link[href]"),
        );
        const tabOf = (page) =>
          tabElements.find((tabElement) => pageIsAt(page, tabElement.href));
        const baseTabElement = tabOf(move.basePage) ?? null;
        const towardTabElement = move.towardPage
          ? (tabOf(move.towardPage) ?? null)
          : null;
        followed = {
          row,
          basePage: move.basePage,
          towardPage: move.towardPage,
          baseTabElement,
          towardTabElement,
          towardIsAfter:
            tabElements.indexOf(towardTabElement) >
            tabElements.indexOf(baseTabElement),
          painted: false,
        };
        followedRef.current = followed;
      }
      if (!followed.baseTabElement) {
        letGo();
        return;
      }
      if (!followed.painted) {
        followed.painted = true;
        writeIndicatorGeometry(navElement, {
          baseTabElement: followed.baseTabElement,
          towardTabElement: followed.towardTabElement,
          towardIsAfter: followed.towardIsAfter,
          vertical,
        });
        navElement.setAttribute("data-nav-indicator-measured", "");
        navElement.setAttribute("data-nav-following-row", "");
      }
      navElement.style.setProperty("--slide-travel-progress", move.progress);
    });
    return () => {
      stopFollowing();
      followedRef.current = null;
      letGo();
    };
  }, [followsRouteRows, vertical]);
  // What the last paint measured for — see the memo at the top of
  // paintIndicatorGeometry.
  const indicatorPaintedForRef = useRef(null);

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
      // Only for a row of slides, and only once — the second look is the one
      // that lands. A row of routes is not ridden: only its bar follows a hand
      // on a RouteTravel (see followRouteRows), and the row lands on the tab
      // when the address gets there.
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
      // Everything that holds for the whole travel is read here and only here
      // — the frame loop below runs sixty times a second and every layout or
      // style read in it is paid on the very frames the travel is drawn on.
      // A row that cannot scroll has nowhere to ride the travel to: remembered
      // on the travel, and the loop is not even armed for it.
      const rideable =
        navElement.scrollWidth > navElement.clientWidth + 1 ||
        navElement.scrollHeight > navElement.clientHeight + 1;
      if (!rideable) {
        travelScrollRef.current = {
          from: currentTabElement,
          toward: towardTabElement,
          rideable,
        };
        return;
      }
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
        rideable,
        left: fromOffsets.left,
        top: fromOffsets.top,
        leftDelta: (towardOffsets.left - fromOffsets.left) * sign,
        topDelta: (towardOffsets.top - fromOffsets.top) * sign,
      };
      rememberProgressAnimation(navElement, travel);
      travelScrollRef.current = travel;
    }
    if (!travel.rideable) {
      return;
    }
    // How far between the two slides the picture stands, read WITHOUT
    // getComputedStyle: computing the style of an element whose registered
    // property is animating is a full style resolve, and per frame it is what
    // ate the travel's frame budget on a throttled phone. The number has two
    // cheap sources, and the container guarantees one of them on this very
    // element (see paintTravelProgress / animateTravelProgress in
    // slide_container.jsx): a travel that plays on its own ANIMATES the
    // property here — its eased progress is on the animation itself
    // (getComputedTiming().progress is the transformed, post-easing progress)
    // — and a finger writes it as INLINE style per frame, readable as a plain
    // string.
    let progress;
    let eased = travel.progressAnimation
      ? travel.progressAnimation.effect.getComputedTiming().progress
      : null;
    if (eased === null) {
      // No animation, or one that is over: the travel may have been
      // re-animated since (a chained travel between the same two tabs), so
      // look again before falling back to the finger's inline value.
      rememberProgressAnimation(navElement, travel);
      eased = travel.progressAnimation
        ? travel.progressAnimation.effect.getComputedTiming().progress
        : null;
    }
    if (eased === null) {
      progress =
        parseFloat(
          navElement.style.getPropertyValue("--slide-travel-progress"),
        ) || 0;
    } else {
      // The animation walks the property from `progressFrom` to 0 (see
      // animateTravelProgress); its value at this instant is the same
      // interpolation, done here in arithmetic instead of in style.
      progress = travel.progressFrom * (1 - eased);
    }
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

  // The row watches its own size, and the size of each tab under a bar it
  // draws itself, and reads itself again when one changes: what was written is
  // pixels, where the trait sits and how far the row is scrolled, and pixels
  // measured on a row or a tab of another size are wrong. The row's own box
  // does not always say it: a row capped at its container's width keeps its
  // size while a label, a badge count or a font that just arrived widens a
  // tab, and a row whose tabs share it keeps its size while one of them folds
  // away — every tab after it moves, and only their sizes tell.
  // A row that had no width at all is the same story with a sharper edge:
  // inside a closed <dialog> everything measures 0, and the current tab does
  // not change when the dialog opens, so nothing else would ever look again.
  // A scroll takes no size from anything, so this stays quiet while the row is
  // being pushed around by hand.
  const sizeObserverRef = useRef(null);
  const observedTabsRef = useRef(new Set());
  useLayoutEffect(() => {
    const navElement = navRef.current;
    const sizeObserver = new ResizeObserver((entries) => {
      // The same pair of tabs measures differently once one of them, or the
      // row, has another size.
      indicatorPaintedForRef.current = null;
      if (followedRef.current) {
        followedRef.current.painted = false;
      }
      paintIndicatorGeometryRef.current();
      // What was brought into sight was brought there for another row. A tab
      // alone changing size leaves the row where it is: it may have been
      // pushed by hand since.
      if (entries.some((entry) => entry.target === navElement)) {
        tabInSightRef.current = null;
        scheduleTabScrollSyncRef.current();
      }
    });
    sizeObserver.observe(navElement);
    sizeObserverRef.current = sizeObserver;
    return () => {
      sizeObserver.disconnect();
      sizeObserverRef.current = null;
      observedTabsRef.current = new Set();
    };
  }, []);
  // Which tabs are watched follows the tabs there are, after every commit: a
  // tab added, removed or replaced.
  const observeTabSizes = () => {
    const navElement = navRef.current;
    const sizeObserver = sizeObserverRef.current;
    if (!navElement || !sizeObserver) {
      return;
    }
    const tabs = new Set();
    if (indicatorPosition || followsRouteRows) {
      for (const tab of navElement.querySelectorAll(
        indicatorPosition ? "[data-slide-target]" : ".navi_link",
      )) {
        tabs.add(tab);
      }
    }
    for (const tab of observedTabsRef.current) {
      if (!tabs.has(tab)) {
        sizeObserver.unobserve(tab);
      }
    }
    for (const tab of tabs) {
      if (!observedTabsRef.current.has(tab)) {
        sizeObserver.observe(tab);
      }
    }
    observedTabsRef.current = tabs;
  };

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
      // Right to left, the row starts at 0 and runs into the negatives: further
      // along is further left.
      const rtl = getComputedStyle(navElement).direction === "rtl";
      const scrollLeftBefore = navElement.scrollLeft;
      const scrollLeftWanted = rtl
        ? Math.min(
            0,
            Math.max(-scrollableWidth, scrollLeftBefore - deltaY * notch),
          )
        : Math.max(
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
      setCurrentSlideArea(readSlideOnScreen(containerElement));
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

  // The one tab whose bar wears the row's name (see the CSS above): the first
  // current tab of the row. Written on the DOM by hand rather than rendered: a
  // route transition photographs the page arriving right after its render,
  // and the tab current there says so from its own layout effect (see
  // tabCurrentChanged) — a render of this row would come after the picture.
  const namedTabRef = useRef(null);
  const duplicateWarnedRef = useRef(false);
  const nameIndicatorTab = () => {
    const navElement = navRef.current;
    if (!navElement || slideContainer) {
      return;
    }
    const currentTabs = currentTabsOf(navElement);
    const namedTab = currentTabs[0] ?? null;
    const previousNamedTab = namedTabRef.current;
    if (namedTab !== previousNamedTab) {
      previousNamedTab?.removeAttribute(NAMED_TAB_ATTRIBUTE);
      namedTab?.setAttribute(NAMED_TAB_ATTRIBUTE, "");
      namedTabRef.current = namedTab;
    }
    if (
      import.meta.dev &&
      currentTabs.length > 1 &&
      rowIndicatorPosition &&
      !duplicateWarnedRef.current
    ) {
      // Looked at again once the tabs re-rendering for one address change have
      // all said so: the tab leaving and the tab arriving tell this row one
      // after the other, in whichever order they render.
      queueMicrotask(() => {
        const navElementNow = navRef.current;
        if (!navElementNow || duplicateWarnedRef.current) {
          return;
        }
        const currentTabsNow = currentTabsOf(navElementNow);
        if (currentTabsNow.length < 2) {
          return;
        }
        duplicateWarnedRef.current = true;
        console.warn(
          `A <Nav currentIndicator> holds ${currentTabsNow.length} current tabs (${currentTabsNow.map((tab) => tab.getAttribute("href")).join(", ")}): each draws its bar, and only the first glides to the next tab. Usually a tab whose route covers the addresses below it (a frame route, "/x/") lit beside the tab of its child: \`currentExcept\` on it names the child it does not stand for.`,
          navElementNow,
        );
      });
    }
  };
  const nameIndicatorTabRef = useRef(null);
  nameIndicatorTabRef.current = nameIndicatorTab;

  // Said by a tab of this row that became, or stopped being, the current one
  // (see link.jsx): a tab re-renders alone when the address moves, and this
  // row, whose parent may not render at all, would otherwise hear of it only
  // at its own next commit or resize. What changes with it is which bar wears
  // the name, and which tab must be in sight.
  const tabCurrentChangedRef = useRef(null);
  if (!tabCurrentChangedRef.current) {
    tabCurrentChangedRef.current = () => {
      nameIndicatorTabRef.current();
      scheduleTabScrollSyncRef.current();
    };
  }

  // Said after every commit: a tab added, removed or renamed moves the trait.
  useLayoutEffect(() => {
    nameIndicatorTab();
    observeTabSizes();
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
      // The row survives the movement: it sits outside any route, or in a
      // page still on screen where the movement goes. The routes have read
      // that address already — a movement is announced once the routing is
      // done, with the render held until its first picture — so the page
      // answers for the destination. A row each page renders for itself is
      // another row on the other side: its bar leaves with its page.
      const page = routePageRef.current;
      const rowSurvives = !page || page.isShown();
      // From a tab of this row: the row still shows the page being left, and
      // the tab it is on. To a tab of this row: one of its links aims at the
      // page the movement goes to. A row mounted while the movement plays hears
      // nothing here and stays unnamed, rightly: its bar is on the second
      // picture alone, with nothing on the first to glide from.
      nameIndicatorTabRef.current();
      const fromTab = namedTabRef.current;
      let toTab = null;
      for (const linkElement of navElement.querySelectorAll("a[href]")) {
        if (linkElement.href === destinationUrl) {
          toTab = linkElement;
          break;
        }
      }
      if (rowSurvives && fromTab && toTab) {
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
      currentIndicator: rowIndicatorPosition ?? undefined,
      slideContainer,
      currentSlideArea,
      tabCurrentChanged: tabCurrentChangedRef.current,
    }),
    [rowIndicatorPosition, slideContainer, currentSlideArea],
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
      data-nav-indicator={
        indicatorPosition ??
        (followsRouteRows ? rowIndicatorPosition : undefined)
      }
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
      // there. Written in every case: the property is not registered, so a row
      // asking for no slide would otherwise inherit the name of a row around
      // it, and two bars would wear it.
      style={{
        ...props.style,
        "--nav-indicator-name":
          currentIndicatorSlides && !slideContainer
            ? indicatorNameRef.current
            : "none",
      }}
      styleCSSVars={NavStyleCSSVars}
    >
      {(indicatorPosition || followsRouteRows) && (
        <span className="navi_nav_indicator" />
      )}
      <NavContext.Provider value={navContextValue}>
        {children}
      </NavContext.Provider>
    </Box>
  );
};
