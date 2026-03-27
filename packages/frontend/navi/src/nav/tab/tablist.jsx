/**
 * TabList component with support for horizontal and vertical layouts
 * https://dribbble.com/search/tabs
 */

import { toChildArray } from "preact";

import { Box } from "../../box/box.jsx";
import { PSEUDO_CLASSES } from "../../box/pseudo_styles.js";
import {
  TabListAlignXContext,
  TabListIndicatorContext,
} from "./tab_context.js";

import.meta.css = /* css */ `
  @layer navi {
    .navi_tablist {
      --tablist-border-radius: 0px;
      --tablist-background: transparent;

      --tab-background: transparent;
      --tab-background-selected: transparent;
      --tab-color: inherit;
      --tab-color-hover: #010409;
      --tab-color-selected: inherit;
      --tab-indicator-size: 2px;
      --tab-indicator-spacing: 0;
      --tab-indicator-color: rgb(205, 52, 37);

      &[data-tab-border-radius="inherit"] {
        --tab-border-radius: calc(
          var(--tablist-border-radius) - var(--tablist-padding)
        );
      }
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
      margin: 0;
      padding-top: var(
        --tablist-padding-top,
        var(--tablist-padding-y, var(--tablist-padding, unset))
      );
      padding-right: var(
        --tablist-padding-right,
        var(--tablist-padding-x, var(--tablist-padding, unset))
      );
      padding-bottom: var(
        --tablist-padding-bottom,
        var(--tablist-padding-y, var(--tablist-padding, unset))
      );
      padding-left: var(
        --tablist-padding-left,
        var(--tablist-padding-x, var(--tablist-padding, unset))
      );
      align-items: center;
      gap: 0.5rem;
      list-style: none;
      background: var(--tablist-background);
      border: var(--tablist-border);
      border-radius: var(--tablist-border-radius);

      > li {
        position: relative;
        display: inline-flex;

        .navi_tab {
          --contrasting-color: black;
          --tab-background-hover: color-mix(
            in srgb,
            var(--tab-background),
            var(--contrasting-color) 15%
          );

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
          align-items: center;
          color: var(--x-tab-color);
          white-space: nowrap;
          background: var(--x-tab-background);
          border-radius: var(--tab-border-radius);
          /* transition: background 0.12s ease-out; */
          user-select: none;

          &[data-dark-background] {
            --contrasting-color: white;
            --tab-color: white;
          }

          > .navi_text:not(.navi_badge_count),
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

        &:first-child {
          border-top-left-radius: inherit;
          border-bottom-left-radius: inherit;

          .navi_tab {
            border-top-left-radius: inherit;
            border-bottom-left-radius: inherit;
          }
        }

        &:last-child {
          border-top-right-radius: inherit;
          border-bottom-right-radius: inherit;

          .navi_tab {
            border-top-right-radius: inherit;
            border-bottom-right-radius: inherit;
          }
        }
      }
    }

    &[data-expand] {
      > ul {
        flex-grow: 1;
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

      &[data-expand] {
        .navi_tab {
          align-items: stretch;
        }
      }
    }

    &[data-expand] {
      > ul {
        .navi_tab {
          width: 100%;
          flex: 1;
          justify-content: start;
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

Object.assign(PSEUDO_CLASSES, {
  ":-navi-tab-selected": {
    attribute: "data-tab-selected",
  },
});
const TabListStyleCSSVars = {
  border: "--tablist-border",
  borderRadius: "--tablist-border-radius",
  padding: "--tablist-padding",
  paddingX: "--tablist-padding-x",
  paddingY: "--tablist-padding-y",
  paddingTop: "--tablist-padding-top",
  paddingRight: "--tablist-padding-right",
  paddingBottom: "--tablist-padding-bottom",
  paddingLeft: "--tablist-padding-left",
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
  tabBorderRadius,
  panelPosition, // before or after
  panelBorderConnection,
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
      data-tab-border-radius={tabBorderRadius}
      data-expand={expand || expandX ? "" : undefined}
      data-vertical={vertical ? "" : undefined}
      data-panel-position={panelPosition}
      data-panel-border-connection={panelBorderConnection ? "" : undefined}
      expand={expand}
      expandX={expandX}
      {...props}
      styleCSSVars={TabListStyleCSSVars}
    >
      <Box as="ul" column role="list" spacing={spacing}>
        <TabListIndicatorContext.Provider value={indicator}>
          <TabListAlignXContext.Provider value={alignX}>
            {children.map((child) => {
              return (
                <Box
                  key={child.props.key}
                  as="li"
                  column
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
