import { useContext } from "preact/hooks";

import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";
import { FlexDirectionContext } from "./layout_context.jsx";
import { useLayoutStyle } from "./use_layout_style.js";

import.meta.css = /* css */ `
  .navi_flex_row {
    display: flex;
    flex-direction: row;
    gap: 0;
  }

  .navi_flex_column {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .navi_flex_item {
    flex-shrink: 0;
  }
`;

export const FlexRow = ({ alignX, alignY, gap, style, children, ...rest }) => {
  const { all } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle(
    {
      ...all,
      // Only set justifyContent if it's not the default "start"
      justifyContent: alignX !== "start" ? alignX : undefined,
      // Only set alignItems if it's not the default "stretch"
      alignItems: alignY !== "stretch" ? alignY : undefined,
      gap,
    },
    style,
  );

  return (
    <div {...rest} className="navi_flex_row" style={innerStyle}>
      <FlexDirectionContext.Provider value="row">
        {children}
      </FlexDirectionContext.Provider>
    </div>
  );
};
export const FlexColumn = ({
  alignX,
  alignY,
  gap,
  style,
  children,
  ...rest
}) => {
  const { all } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle(
    {
      ...all,
      // Only set alignItems if it's not the default "stretch"
      alignItems: alignX !== "stretch" ? alignX : undefined,
      // Only set justifyContent if it's not the default "start"
      justifyContent: alignY !== "start" ? alignY : undefined,
      gap,
    },
    style,
  );

  return (
    <div {...rest} className="navi_flex_column" style={innerStyle}>
      <FlexDirectionContext.Provider value="column">
        {children}
      </FlexDirectionContext.Provider>
    </div>
  );
};

export const FlexItem = ({
  shrink,
  className,
  expand,
  style,
  children,
  ...rest
}) => {
  const flexDirection = useContext(FlexDirectionContext);
  if (!flexDirection) {
    console.warn(
      "FlexItem must be used within a FlexRow or FlexColumn component.",
    );
  }

  const innerClassName = withPropsClassName("navi_flex_item", className);
  const { all } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle(
    {
      ...all,
      flexGrow: expand ? 1 : undefined,
      flexShrink: shrink ? 1 : undefined,
    },
    style,
  );

  return (
    <div {...rest} className={innerClassName} style={innerStyle}>
      {children}
    </div>
  );
};
