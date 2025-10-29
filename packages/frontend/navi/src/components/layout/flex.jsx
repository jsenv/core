import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";
import { consumeSpacingProps } from "./spacing.jsx";

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

const FlexDirectionContext = createContext();

export const FlexRow = ({ alignX, alignY, gap, style, children, ...rest }) => {
  const innerStyle = withPropsStyle(
    {
      // Only set justifyContent if it's not the default "start"
      justifyContent: alignX !== "start" ? alignX : undefined,
      // Only set alignItems if it's not the default "stretch"
      alignItems: alignY !== "stretch" ? alignY : undefined,
      gap,
      ...consumeSpacingProps(rest),
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
  const innerStyle = withPropsStyle(
    {
      // Only set alignItems if it's not the default "stretch"
      alignItems: alignX !== "stretch" ? alignX : undefined,
      // Only set justifyContent if it's not the default "start"
      justifyContent: alignY !== "start" ? alignY : undefined,
      gap,
      ...consumeSpacingProps(rest),
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
export const useConsumAlignProps = (props) => {
  const flexDirection = useContext(FlexDirectionContext);

  const alignX = props.alignX;
  const alignY = props.alignY;
  delete props.alignX;
  delete props.alignY;

  const style = {};

  if (flexDirection === "row") {
    // In row direction: alignX controls justify-content, alignY controls align-self
    if (alignY !== undefined && alignY !== "start") {
      style.alignSelf = alignY;
    }
    // For row, alignX uses auto margins for positioning
    // NOTE: Auto margins only work effectively for positioning individual items.
    // When multiple adjacent items have the same auto margin alignment (e.g., alignX="end"),
    // only the first item will be positioned as expected because subsequent items
    // will be positioned relative to the previous item's margins, not the container edge.
    if (alignX !== undefined) {
      if (alignX === "start") {
        style.marginRight = "auto";
      } else if (alignX === "end") {
        style.marginLeft = "auto";
      } else if (alignX === "center") {
        style.marginLeft = "auto";
        style.marginRight = "auto";
      }
    }
  } else if (flexDirection === "column") {
    // In column direction: alignX controls align-self, alignY uses auto margins
    if (alignX !== undefined && alignX !== "start") {
      style.alignSelf = alignX;
    }
    // For column, alignY uses auto margins for positioning
    // NOTE: Same auto margin limitation applies - multiple adjacent items with
    // the same alignY won't all position relative to container edges.
    if (alignY !== undefined) {
      if (alignY === "start") {
        style.marginBottom = "auto";
      } else if (alignY === "end") {
        style.marginTop = "auto";
      } else if (alignY === "center") {
        style.marginTop = "auto";
        style.marginBottom = "auto";
      }
    }
  }

  return style;
};
export const FlexItem = ({
  alignX,
  alignY,
  grow,
  shrink,
  className,
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
  const alignStyle = useConsumAlignProps({ alignX, alignY });
  const innerStyle = withPropsStyle(
    {
      flexGrow: grow ? 1 : undefined,
      flexShrink: shrink ? 1 : undefined,
      ...consumeSpacingProps(rest),
      ...alignStyle,
    },
    style,
  );

  return (
    <div {...rest} className={innerClassName} style={innerStyle}>
      {children}
    </div>
  );
};
