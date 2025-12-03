/**
 * TabList component with support for horizontal and vertical layouts
 */

import { createContext, toChildArray } from "preact";
import { useContext } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { PSEUDO_CLASSES } from "../../box/pseudo_styles.js";
import { useRouteStatus } from "../route.js";
import { RouteLink } from "../route_link.jsx";

Object.assign(PSEUDO_CLASSES, {
  ":-navi-selected": {
    attribute: "data-selected",
  },
});

import.meta.css = /* css */ `
  @layer navi {
    .navi_tablist {
      --tablist-border-radius: 8px;
      --tablist-background: transparent;
      --tab-border-radius: calc(var(--tablist-border-radius) - 2px);

      --tab-background: transparent;
      --tab-background-hover: #dae0e7;
      --tab-background-selected: transparent;
      --tab-color: inherit;
      --tab-color-hover: #010409;
      --tab-color-selected: inherit;
      --tab-indicator-size: 2px;
      --tab-indicator-color: rgb(205, 52, 37);
    }
  }

  .navi_tablist {
    display: flex;
    line-height: 2em;
    overflow-x: auto;
    overflow-y: hidden;

    > ul {
      display: flex;
      width: 100%;
      margin: 0;
      padding: 2px; /* space for border radius and outline */
      align-items: center;
      gap: 0.5rem;
      list-style: none;
      background: var(--tablist-background);
      border-radius: var(--tablist-border-radius);

      > li {
        position: relative;
        display: inline-flex;

        .navi_tab {
          --x-tab-background: var(--tab-background);
          --x-tab-color: var(--tab-color);

          display: flex;
          flex-direction: column;
          white-space: nowrap;
          border-radius: var(--tab-border-radius);

          .navi_tab_content {
            display: flex;
            color: var(--x-tab-color);
            background: var(--x-tab-background);
            border-radius: inherit;
            transition: background 0.12s ease-out;

            .navi_link {
              flex-grow: 1;
              text-align: center;
              border-radius: inherit;
            }
          }
          /* Hidden bold clone to reserve space for bold width without affecting height */
          .navi_tab_content_bold_clone {
            display: block; /* in-flow so it contributes to width */
            height: 0; /* zero height so it doesn't change layout height */
            font-weight: 600; /* force bold to compute max width */
            visibility: hidden; /* not visible */
            pointer-events: none; /* inert */
            overflow: hidden; /* avoid any accidental height */
          }
          .navi_tab_indicator {
            z-index: 1;
            display: flex;
            width: 100%;
            height: var(--tab-indicator-size);
            margin-top: 5px;
            background: transparent;
            border-radius: 0.1px;
          }

          /* Interactive */
          &[data-interactive] {
            cursor: pointer;
          }
          /* Hover */
          &:hover {
            --x-tab-background: var(--tab-background-hover);
            --x-tab-color: var(--tab-color-hover);
          }
          /* Selected */
          &[data-selected] {
            --x-tab-background: var(--tab-background-selected);
            --x-tab-color: var(--tab-color-selected);

            .navi_tab_content {
              font-weight: 600;
            }
            .navi_tab_indicator {
              background: var(--tab-indicator-color);
            }
          }
        }
      }
    }

    /* Vertical layout */
    &[data-vertical] {
      overflow-x: hidden;
      overflow-y: auto;

      > ul {
        flex-direction: column;
        align-items: stretch;

        > li {
          .navi_tab {
            .navi_tab_content {
              justify-content: flex-start;
              text-align: left;

              .navi_link {
                text-align: left;
              }
            }
            .navi_tab_indicator {
              width: var(--tab-indicator-size);
              height: 100%;
              margin-top: 0;
              margin-right: 5px;
              margin-left: auto;
            }
          }
        }
      }

      &[data-expand] {
        > ul {
          .navi_tab {
            flex: 1;
            align-items: center;
            align-items: stretch;

            .navi_tab_content {
              width: 100%;
              justify-content: center;
            }
          }
        }
      }
    }
  }
`;

const TabListIndicatorContext = createContext();
const TabListStyleCSSVars = {
  borderRadius: "--tablist-border-radius",
  background: "--tablist-background",
};
export const TabList = ({
  children,
  spacing,
  vertical,
  indicator = vertical ? "start" : "end",
  expand,
  expandX,
  paddingX,
  paddingY,
  padding,
  ...props
}) => {
  children = toChildArray(children);

  return (
    <Box
      as="nav"
      baseClassName="navi_tablist"
      role="tablist"
      data-expand={expand || expandX ? "" : undefined}
      data-vertical={vertical ? "" : undefined}
      expand={expand}
      expandX={expandX}
      {...props}
      styleCSSVars={TabListStyleCSSVars}
    >
      <Box
        as="ul"
        column
        role="list"
        paddingX={paddingX}
        paddingY={paddingY}
        padding={padding}
        spacing={spacing}
      >
        <TabListIndicatorContext.Provider value={indicator}>
          {children.map((child) => {
            return (
              <Box
                as="li"
                column
                key={child.props.key}
                expandX={expandX}
                expand={expand}
              >
                {child}
              </Box>
            );
          })}
        </TabListIndicatorContext.Provider>
      </Box>
    </Box>
  );
};

const TAB_STYLE_CSS_VARS = {
  "background": "--tab-background",
  "color": "--tab-color",
  ":hover": {
    background: "--tab-background-hover",
    color: "--tab-color-hover",
  },
  ":-navi-selected": {
    background: "--tab-color-selected",
    color: "--tab-color-selected",
  },
};
const TAB_PSEUDO_CLASSES = [":hover", ":-navi-selected"];
const TAB_PSEUDO_ELEMENTS = ["::-navi-indicator"];
export const Tab = (props) => {
  if (props.route) {
    return <TabRoute {...props} />;
  }
  return <TabBasic {...props} />;
};
TabList.Tab = Tab;

const TabRoute = ({
  route,
  routeParams,
  children,
  paddingX,
  padding,
  paddingY,
  ...props
}) => {
  const { active } = useRouteStatus(route);
  return (
    <TabBasic selected={active} paddingX="0" {...props}>
      <RouteLink
        route={route}
        routeParams={routeParams}
        expand
        discrete
        paddingX={paddingX}
        padding={padding}
        paddingY={paddingY}
      >
        {children}
      </RouteLink>
    </TabBasic>
  );
};
const TabBasic = ({
  children,
  selected,
  padding,
  paddingX = "s",
  paddingY,
  onClick,
  ...props
}) => {
  const tabListIndicator = useContext(TabListIndicatorContext);

  return (
    <Box
      role="tab"
      aria-selected={selected ? "true" : "false"}
      data-interactive={onClick ? "" : undefined}
      onClick={onClick}
      // Style system
      baseClassName="navi_tab"
      styleCSSVars={TAB_STYLE_CSS_VARS}
      pseudoClasses={TAB_PSEUDO_CLASSES}
      pseudoElements={TAB_PSEUDO_ELEMENTS}
      basePseudoState={{
        ":-navi-selected": selected,
      }}
      {...props}
    >
      <Box
        className="navi_tab_content"
        paddingX={paddingX}
        paddingY={paddingY}
        padding={padding}
      >
        {children}
      </Box>
      <div className="navi_tab_content_bold_clone" aria-hidden="true">
        {children}
      </div>
      {tabListIndicator && (
        <span
          className="navi_tab_indicator"
          data-position={tabListIndicator}
        ></span>
      )}
    </Box>
  );
};
