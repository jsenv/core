/**
 * TabList component with support for horizontal and vertical layouts
 * https://dribbble.com/search/tabs
 */

import { toChildArray } from "preact";
import { useMemo, useRef } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { NavContext } from "./nav_context.js";

// A name of its own for the bar under the current tab, one per nav on the page:
// two bars answering to the same name are two elements claiming one picture,
// and the browser refuses the whole transition rather than pick.
let navCount = 0;

const css = /* css */ `
  @layer navi {
    .navi_nav {
      --nav-border: none;
      --nav-padding: 0px;
      --nav-border-radius: 0px;
      --nav-background: transparent;
    }
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

    &[data-expand] {
      flex-grow: 1;

      .navi_tab {
        flex: 1;
        justify-content: start;
      }
    }
    /* Vertical layout */
    &[data-vertical] {
      /* overflow-x: hidden; */
      /* overflow-y: auto; */
      align-items: stretch;

      &[data-expand] {
        .navi_tab {
          align-items: stretch;
        }
      }
      .navi_tab {
        width: 100%;
        flex-direction: row;
        text-align: left;
      }
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
};
/**
 * @type {import("preact").FunctionComponent<{
 *   currentIndicator?: boolean|"top"|"bottom"|"left"|"right",
 *   currentIndicatorSlides?: boolean,
 * }>}
 * @param {boolean|"top"|"bottom"|"left"|"right"} [props.currentIndicator] - the
 *   bar that says which tab one is on, said once here rather than on every
 *   `<Link>`. A link may still say otherwise for itself.
 * @param {boolean} [props.currentIndicatorSlides=true] - whether that bar
 *   travels from the tab it was under to the tab it is under now, instead of
 *   going out on one and coming back on the other. It does so by being NAMED,
 *   which is all the browser needs: any change played as a view transition
 *   animates it on the same clock as everything else in that transition. Inside
 *   a `RouteTravel` that means it follows the pages, and the thumb dragging
 *   them, without either of them being told about the other.
 */
export const Nav = ({
  children,
  spacing,
  vertical,
  expand,
  expandX,
  linkBorderRadiusInherit,
  currentIndicator,
  currentIndicatorSlides = true,
  panelPosition, // "before" or "after": which side the panel sits on, turning the nav into folder tabs
  ...props
}) => {
  import.meta.css = css;

  const indicatorNameRef = useRef(null);
  if (indicatorNameRef.current === null) {
    indicatorNameRef.current = `navi-nav-indicator-${++navCount}`;
  }
  const navContextValue = useMemo(
    () => ({
      currentIndicator,
      // Read by the link that is current, and by it alone: a name belongs to
      // one element at a time, and the bar exists in every tab.
      indicatorName: currentIndicatorSlides ? indicatorNameRef.current : null,
    }),
    [currentIndicator, currentIndicatorSlides],
  );

  children = toChildArray(children);

  return (
    <Box
      as="nav"
      row={vertical}
      column={!vertical}
      baseClassName="navi_nav"
      data-link-border-radius-inherit={linkBorderRadiusInherit ? "" : undefined}
      data-expand={expand || expandX ? "" : undefined}
      data-vertical={vertical ? "" : undefined}
      data-panel-position={panelPosition}
      expand={expand}
      expandX={expandX}
      spacing={spacing}
      {...props}
      styleCSSVars={NavStyleCSSVars}
    >
      <NavContext.Provider value={navContextValue}>
        {children}
      </NavContext.Provider>
    </Box>
  );
};
