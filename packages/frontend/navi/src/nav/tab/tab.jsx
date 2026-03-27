import { useContext, useRef, useState } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { Text } from "../../text/text.jsx";
import { useDarkBackgroundAttribute } from "../../text/use_dark_background_attribute.js";
import { RouteLink } from "../route_link.jsx";
import {
  ReportSelectedOnTabContext,
  TabListIndicatorContext,
} from "./tab_context.js";

import.meta.css = /* css */ `
  @layer navi {
    .navi_tab {
    }
  }

  .navi_tab {
    --contrasting-color: black;
    --tab-background-hover: color-mix(
      in srgb,
      var(--tab-background),
      var(--contrasting-color) 15%
    );

    --x-tab-background: var(--tab-background-color, var(--tab-background));
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
    border: none;
    border-radius: var(--tab-border-radius);
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
`;

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

const TabBasic = ({
  children,
  icon,
  selected,
  boldWhenSelected = !icon,
  indicator,
  onClick,
  row,
  column = !row,
  alignX,
  ...props
}) => {
  const tabListIndicator = useContext(TabListIndicatorContext);
  const innerIndicator =
    indicator === undefined ? tabListIndicator || "end" : indicator;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const [selectedFromChild, setSelectedFromChild] = useState(false);
  const innerSelected = selected || selectedFromChild;

  useDarkBackgroundAttribute(ref, [innerSelected], {});

  return (
    <Box
      as="button"
      ref={ref}
      role="tab"
      aria-selected={innerSelected ? "true" : "false"}
      data-interactive={onClick ? "" : undefined}
      data-bold-when-selected={boldWhenSelected ? "" : undefined}
      onClick={onClick}
      // Style system
      baseClassName="navi_tab"
      styleCSSVars={TAB_STYLE_CSS_VARS}
      pseudoClasses={TAB_PSEUDO_CLASSES}
      pseudoElements={TAB_PSEUDO_ELEMENTS}
      basePseudoState={{
        ":-navi-tab-selected": innerSelected,
      }}
      selfAlignX={alignX}
      data-align-x={alignX}
      row={row}
      column={column}
      {...props}
    >
      {(innerIndicator === "start" || innerIndicator === "end") && (
        <span className="navi_tab_indicator" data-position={innerIndicator} />
      )}
      <ReportSelectedOnTabContext.Provider value={setSelectedFromChild}>
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
      </ReportSelectedOnTabContext.Provider>
    </Box>
  );
};
