import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { withPropsClassName } from "../props_composition/with_props_class_name.js";
import { withPropsStyle } from "../props_composition/with_props_style.js";
import { consumeSpacingProps } from "./spacing.jsx";

import.meta.css = /* css */ `
  .navi_flex_row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0;
  }

  .navi_flex_column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  .navi_flex_item {
    flex-shrink: 0;
  }
`;

const FlexDirectionContext = createContext();

export const FlexRow = ({ alignY, gap, style, children, ...rest }) => {
  const innerStyle = withPropsStyle(
    {
      alignItems: alignY,
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
export const FlexColumn = ({ alignX, gap, style, children, ...rest }) => {
  const innerStyle = withPropsStyle(
    {
      alignItems: alignX,
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
    // Default alignY is "center" from CSS, so only set alignSelf when different
    if (alignY !== undefined && alignY !== "center") {
      style.alignSelf = alignY;
    }
    // For row, alignX doesn't have a meaningful default for justifySelf
    if (alignX !== undefined) {
      style.justifySelf = alignX;
    }
  } else if (flexDirection === "column") {
    // In column direction: alignX controls align-self, alignY controls justify-content
    // Default alignX is "center" from CSS, so only set alignSelf when different
    if (alignX !== undefined && alignX !== "center") {
      style.alignSelf = alignX;
    }
    // For column, alignY doesn't have a meaningful default for justifySelf
    if (alignY !== undefined) {
      style.justifySelf = alignY;
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
