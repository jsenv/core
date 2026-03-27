/**
 * TabList component with support for horizontal and vertical layouts
 * https://dribbble.com/search/tabs
 */

import { toChildArray } from "preact";

import { Box } from "../../box/box.jsx";
import { NavContext, NavIndicatorPositionContext } from "./nav_context.js";

import.meta.css = /* css */ `
  @layer navi {
    .navi_nav {
      --nav-border-radius: 0px;
      --nav-background: transparent;
    }
  }

  .navi_nav {
    margin: 0;
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
    align-items: center;
    gap: 0.5rem;
    line-height: 2;
    background: var(--nav-background);
    border: var(--nav-border);
    border-radius: var(--nav-border-radius);
    /* overflow-x: auto; */
    /* overflow-y: hidden; */

    .navi_link {
      display: inline-flex;
      line-height: inherit;

      &:first-child {
        border-top-left-radius: inherit;
        border-bottom-left-radius: inherit;
      }
      &:last-child {
        border-top-right-radius: inherit;
        border-bottom-right-radius: inherit;
      }
    }
    &[data-link-border-radius="inherit"] {
      --link-border-radius: calc(var(--nav-border-radius) - var(--nav-padding));
      .navi_link {
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
      align-items: start;

      .navi_tab {
        width: 100%;
        flex-direction: row;
        text-align: left;

        .navi_tab_indicator {
          width: var(--tab-indicator-size);
          height: 100%;
        }

        > .navi_text,
        .navi_link,
        .navi_text_bold_foreground {
          justify-content: start;
        }

        &[data-align-x="end"] {
          > .navi_text,
          .navi_link,
          .navi_text_bold_foreground {
            justify-content: end;
          }
        }
      }

      &[data-expand] {
        .navi_tab {
          align-items: stretch;
        }
      }
    }

    &[data-panel-border-connection] {
      --tablist-border-width: 10px;
      position: relative;
      z-index: 1;

      .navi_tab {
        border: var(--tablist-border-width) solid transparent;

        &[data-tab-selected] {
          border-color: gray;
          border-bottom-color: var(--tablist-background);

          border-top-left-radius: 5px;
          border-top-right-radius: 5px;
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
export const Nav = ({
  children,
  spacing,
  vertical,
  row = false,
  expand,
  expandX,
  linkBorderRadius,
  currentIndicator,
  currentIndicatorPosition = row ? "right" : "bottom",
  panelPosition, // before or after
  panelBorderConnection,
  ...props
}) => {
  children = toChildArray(children);

  return (
    <Box
      as="nav"
      baseClassName="navi_nav"
      column={!row}
      row={row}
      data-link-border-radius={linkBorderRadius}
      data-expand={expand || expandX ? "" : undefined}
      data-vertical={vertical ? "" : undefined}
      data-panel-position={panelPosition}
      data-panel-border-connection={panelBorderConnection ? "" : undefined}
      expand={expand}
      expandX={expandX}
      spacing={spacing}
      {...props}
      styleCSSVars={NavStyleCSSVars}
    >
      <NavIndicatorPositionContext.Provider
        value={currentIndicator ? currentIndicatorPosition : undefined}
      >
        <NavContext.Provider value={true}>{children}</NavContext.Provider>
      </NavIndicatorPositionContext.Provider>
    </Box>
  );
};
