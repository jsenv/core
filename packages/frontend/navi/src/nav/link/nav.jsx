/**
 * TabList component with support for horizontal and vertical layouts
 * https://dribbble.com/search/tabs
 */

import { toChildArray } from "preact";

import { Box } from "../../box/box.jsx";
import { NavBinderSvg } from "./nav_binder.jsx";
import { NavContext } from "./nav_context.js";

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

    &[data-panel-border-connection] {
      --nav-border-width: 10px;
      position: relative;
      z-index: 1;

      .navi_link {
        border: var(--nav-border-width) solid transparent;

        &[data-tab-selected] {
          border-color: gray;
          border-bottom-color: var(--nav-background);

          border-top-left-radius: 5px;
          border-top-right-radius: 5px;
        }
      }
    }

    /* Binder variant: the border around nav + panel is a single SVG path
       (see nav_binder.jsx). The nav must NOT create a stacking context so
       links, svg and the panel sibling can interleave in the parent one:
       inactive links (z 0) under the svg border band (z 1, drawn over their
       panel-side margin edge), current link and panel content above (z 2). */
    &[data-variant="binder"] {
      --nav-border-width: 2px;
      --nav-border-radius: 8px;
      --nav-border-color: light-dark(#bbbbbb, #555555);
      --nav-background: light-dark(#ffffff, #1e1e1e);
      --link-background-current: transparent;
      position: relative;

      .navi_link {
        position: relative;
        z-index: 0;

        &[data-href-current] {
          z-index: 2;
        }
      }

      /* The margin on the panel side hosts the junction border band the
         tabs overlap; corners away from the panel are rounded. */
      &:not([data-vertical])[data-panel-position="after"] .navi_link {
        margin-bottom: var(--nav-border-width);
        border-radius: var(--nav-border-radius) var(--nav-border-radius) 0 0;
      }
      &:not([data-vertical])[data-panel-position="before"] .navi_link {
        margin-top: var(--nav-border-width);
        border-radius: 0 0 var(--nav-border-radius) var(--nav-border-radius);
      }
      &[data-vertical][data-panel-position="after"] .navi_link {
        margin-right: var(--nav-border-width);
        border-radius: var(--nav-border-radius) 0 0 var(--nav-border-radius);
      }
      &[data-vertical][data-panel-position="before"] .navi_link {
        margin-left: var(--nav-border-width);
        border-radius: 0 var(--nav-border-radius) var(--nav-border-radius) 0;
      }
    }
  }

  /* The panel (nav sibling) must paint above the binder svg fill — see the
     stacking note in the binder block above. */
  .navi_nav[data-variant="binder"][data-panel-position="after"] + *,
  :has(+ .navi_nav[data-variant="binder"][data-panel-position="before"]) {
    position: relative;
    z-index: 2;
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
 * @param {"binder"} [variant] - `"binder"` draws the nav and its panel as one
 *   shape: a single border wraps both, and the current tab opens into the
 *   panel through concave junction curves. The panel is the nav's sibling
 *   element (next sibling for `panelPosition="after"` — the default — previous
 *   sibling for `"before"`) and is expected to bring no background/border of
 *   its own: the variant draws them. Themed via CSS vars on the nav:
 *   `--nav-border-width`, `--nav-border-radius`, `--nav-border-color`,
 *   `--nav-background`.
 */
export const Nav = ({
  children,
  spacing,
  vertical,
  expand,
  expandX,
  linkBorderRadiusInherit,
  variant,
  panelPosition, // before or after
  panelBorderConnection,
  ...props
}) => {
  import.meta.css = css;

  children = toChildArray(children);

  if (variant === "binder" && panelPosition === undefined) {
    panelPosition = "after";
  }

  return (
    <Box
      as="nav"
      row={vertical}
      column={!vertical}
      baseClassName="navi_nav"
      data-link-border-radius-inherit={linkBorderRadiusInherit ? "" : undefined}
      data-expand={expand || expandX ? "" : undefined}
      data-vertical={vertical ? "" : undefined}
      data-variant={variant}
      data-panel-position={panelPosition}
      data-panel-border-connection={panelBorderConnection ? "" : undefined}
      expand={expand}
      expandX={expandX}
      spacing={spacing}
      {...props}
      styleCSSVars={NavStyleCSSVars}
    >
      <NavContext.Provider value={true}>
        {variant === "binder" && (
          <NavBinderSvg panelPosition={panelPosition} vertical={vertical} />
        )}
        {children}
      </NavContext.Provider>
    </Box>
  );
};
