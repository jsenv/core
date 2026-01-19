/**
 * TabList component with support for horizontal and vertical layouts
 */

import { createContext, toChildArray } from "preact";
import { useContext } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { PSEUDO_CLASSES } from "../../box/pseudo_styles.js";
import { Text } from "../../text/text.jsx";
import { useRouteStatus } from "../route.js";
import { RouteLink } from "../route_link.jsx";

Object.assign(PSEUDO_CLASSES, {
  ":-navi-tab-selected": {
    attribute: "data-tab-selected",
  },
});

import.meta.css = /* css */ `
  @layer navi {
    .navi_tablist {
      --tablist-border-radius: 0px;
      --tablist-background: transparent;
      --tab-border-radius: calc(var(--tablist-border-radius) - 2px);

      --tab-background: transparent;
      --tab-background-hover: #dae0e7;
      --tab-background-selected: transparent;
      --tab-color: inherit;
      --tab-color-hover: #010409;
      --tab-color-selected: inherit;
      --tab-indicator-size: 2px;
      --tab-indicator-spacing: 0;
      --tab-indicator-color: rgb(205, 52, 37);
    }
  }

  .navi_tablist {
    display: flex;
    line-height: 2;
    /* overflow-x: auto; */
    /* overflow-y: hidden; */

    &[data-tab-indicator-position="start"] {
      .navi_tab {
        margin-top: var(--tab-indicator-spacing);
      }
    }
    &[data-tab-indicator-position="end"] {
      .navi_tab {
        margin-bottom: var(--tab-indicator-spacing);
      }
    }

    > ul {
      display: flex;
      width: 100%;
      margin: 0;
      padding: 0;
      align-items: center;
      gap: 0.5rem;
      list-style: none;
      background: var(--tablist-background);
      border-radius: var(--tablist-border-radius);

      > li {
        position: relative;
        display: inline-flex;

        .navi_tab {
          --x-tab-background: var(
            --tab-background-color,
            var(--tab-background)
          );
          --x-tab-background-hover: var(
            --tab-background-color-hover,
            var(--tab-background-color, var(--tab-background-hover))
          );
          --x-tab-background-selected: var(
            --tab-background-color-selected,
            var(--tab-background-selected)
          );
          --x-tab-color: var(--tab-color);

          display: flex;
          padding: 2px; /* Space for eventual outline inside the tab (link) */
          flex-direction: column;
          color: var(--x-tab-color);
          white-space: nowrap;
          background: var(--x-tab-background);
          border-radius: var(--tab-border-radius);
          transition: background 0.12s ease-out;
          user-select: none;

          > .navi_text,
          .navi_link,
          .navi_button,
          .navi_text_bold_wrapper,
          .navi_text_bold_clone,
          .navi_text_bold_foreground {
            display: inline-flex;
            flex-grow: 1;
            justify-content: center;
            text-align: center;
            border-radius: inherit;
          }

          .navi_tab_indicator {
            position: absolute;
            z-index: 1;
            display: flex;
            width: 100%;
            height: var(--tab-indicator-size);
            background: transparent;
            border-radius: 0.1px;

            &[data-position="start"] {
              top: 0;
              left: 0;
            }

            &[data-position="end"] {
              bottom: 0;
              left: 0;
            }
          }

          /* Interactive */
          &[data-interactive] {
            cursor: pointer;
          }
          /* Hover */
          &[data-hover] {
            --x-tab-background: var(--x-tab-background-hover);
            --x-tab-color: var(--tab-color-hover);
          }
          /* Selected */
          &[data-tab-selected] {
            --x-tab-background: var(--x-tab-background-selected);
            --x-tab-color: var(--tab-color-selected);
            &[data-bold-when-selected] {
              font-weight: bold;
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
      /* overflow-x: hidden; */
      /* overflow-y: auto; */

      > ul {
        flex-direction: column;
        align-items: start;

        > li {
          width: 100%;

          .navi_tab {
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
        }
      }

      &[data-tab-indicator-position="start"] {
        .navi_tab {
          margin-top: 0;
          margin-left: var(--tab-indicator-spacing);

          .navi_tab_indicator {
            top: 0;
            left: 0;
          }
        }
      }
      &[data-tab-indicator-position="end"] {
        .navi_tab {
          margin-right: var(--tab-indicator-spacing);
          margin-bottom: 0;

          .navi_tab_indicator {
            top: 0;
            right: 0;
            left: auto;
          }
        }
      }
    }

    &[data-expand] {
      > ul {
        .navi_tab {
          width: 100%;
          flex: 1;
          align-items: stretch;
          justify-content: start;
        }
      }
    }
  }
`;

const TabListIndicatorContext = createContext();
const TabListAlignXContext = createContext();
const TabListStyleCSSVars = {
  borderRadius: "--tablist-border-radius",
  background: "--tablist-background",
};
export const TabList = ({
  children,
  spacing,
  vertical,
  indicator = vertical ? "start" : "end",
  alignX,
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
      data-tab-indicator-position={
        indicator === "start" || indicator === "end" ? indicator : undefined
      }
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
          <TabListAlignXContext.Provider value={alignX}>
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
          </TabListAlignXContext.Provider>
        </TabListIndicatorContext.Provider>
      </Box>
    </Box>
  );
};

const TAB_STYLE_CSS_VARS = {
  "background": "--tab-background",
  "backgroundColor": "--tab-background-color",
  "color": "--tab-color",
  ":hover": {
    background: "--tab-background-hover",
    backgroundColor: "--tab-background-color-hover",
    color: "--tab-color-hover",
  },
  ":-navi-tab-selected": {
    background: "--tab-background-selected",
    backgroundColor: "--tab-background-color-selected",
    color: "--tab-color-selected",
  },
};
const TAB_PSEUDO_CLASSES = [":hover", ":-navi-tab-selected"];
const TAB_PSEUDO_ELEMENTS = ["::-navi-indicator"];
export const Tab = (props) => {
  if (props.route) {
    return <TabRoute {...props} />;
  }
  return <TabBasic {...props} />;
};
TabList.Tab = Tab;

const TabRoute = ({
  circle,
  route,
  routeParams,
  children,
  padding = 2,
  paddingX,
  paddingY,
  paddingLeft,
  paddingRight,
  paddingTop,
  paddingBottom,
  alignX,
  alignY,

  ...props
}) => {
  const { matching } = useRouteStatus(route);
  const paramsAreMatching = route.matchesParams(routeParams);
  const selected = matching && paramsAreMatching;

  return (
    <TabBasic
      selected={selected}
      {...props}
      circle={circle}
      padding="0"
      alignX={alignX}
      alignY={alignY}
    >
      <RouteLink
        box
        circle={circle}
        route={route}
        routeParams={routeParams}
        expand
        discrete
        padding={padding}
        paddingX={paddingX}
        paddingY={paddingY}
        paddingLeft={paddingLeft}
        paddingRight={paddingRight}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        alignX={alignX}
        alignY={alignY}
      >
        {children}
      </RouteLink>
    </TabBasic>
  );
};
const TabBasic = ({
  children,
  icon,
  selected,
  boldWhenSelected = !icon,
  onClick,
  ...props
}) => {
  const tabListIndicator = useContext(TabListIndicatorContext);
  const tabListAlignX = useContext(TabListAlignXContext);

  return (
    <Box
      role="tab"
      aria-selected={selected ? "true" : "false"}
      data-interactive={onClick ? "" : undefined}
      data-bold-when-selected={boldWhenSelected ? "" : undefined}
      onClick={onClick}
      // Style system
      baseClassName="navi_tab"
      styleCSSVars={TAB_STYLE_CSS_VARS}
      pseudoClasses={TAB_PSEUDO_CLASSES}
      pseudoElements={TAB_PSEUDO_ELEMENTS}
      basePseudoState={{
        ":-navi-tab-selected": selected,
      }}
      selfAlignX={tabListAlignX}
      data-align-x={tabListAlignX}
      {...props}
    >
      {(tabListIndicator === "start" || tabListIndicator === "end") && (
        <span className="navi_tab_indicator" data-position={tabListIndicator} />
      )}
      {boldWhenSelected ? (
        <Text
          preventBoldLayoutShift
          // boldTransition
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Box>
  );
};
