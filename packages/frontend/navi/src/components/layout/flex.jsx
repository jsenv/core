import { createContext } from "preact";
import { useContext } from "preact/hooks";

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
  if (alignX !== "start") {
  }

  return style;
};
export const FlexItem = ({
  alignX,
  alignY,
  grow,
  shrink,
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
    <div {...rest} className="navi_flex_item" style={innerStyle}>
      {children}
    </div>
  );
};
