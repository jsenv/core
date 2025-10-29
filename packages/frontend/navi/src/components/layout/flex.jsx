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
`;

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
    <div className="navi_flex_row" style={innerStyle}>
      {children}
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
    <div className="navi_flex_column" style={innerStyle}>
      {children}
    </div>
  );
};
