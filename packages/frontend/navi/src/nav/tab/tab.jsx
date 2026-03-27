import { useContext, useRef, useState } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { Text } from "../../text/text.jsx";
import { useDarkBackgroundAttribute } from "../../text/use_dark_background_attribute.js";
import { RouteLink } from "../route_link.jsx";
import {
  ReportSelectedOnTabContext,
  TabListAlignXContext,
  TabListIndicatorContext,
} from "./tab_context.js";

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
  onClick,
  row,
  column = !row,
  ...props
}) => {
  const tabListIndicator = useContext(TabListIndicatorContext);
  const tabListAlignX = useContext(TabListAlignXContext);
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const [selectedFromChild, setSelectedFromChild] = useState(false);
  const innerSelected = selected || selectedFromChild;

  useDarkBackgroundAttribute(ref, [innerSelected], {});

  return (
    <Box
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
      selfAlignX={tabListAlignX}
      data-align-x={tabListAlignX}
      row={row}
      column={column}
      {...props}
    >
      {(tabListIndicator === "start" || tabListIndicator === "end") && (
        <span className="navi_tab_indicator" data-position={tabListIndicator} />
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

const TabRoute = ({
  circle,
  route,
  routeParams,
  children,
  padding = 2,
  paddingX = padding,
  paddingY = padding,
  paddingLeft = paddingX,
  paddingRight = paddingX,
  paddingTop = paddingY,
  paddingBottom = paddingY,
  alignX,
  alignY,

  ...props
}) => {
  return (
    <TabBasic
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
