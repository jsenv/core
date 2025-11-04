import { withPropsStyle } from "../props_composition/with_props_style.js";

export const Spacing = ({ children, ...rest }) => {
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    spacing: true,
    visual: true,
  });

  return (
    <div {...remainingProps} style={innerStyle}>
      {children}
    </div>
  );
};
