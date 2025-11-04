import { withPropsStyle } from "../props_composition/with_props_style.js";

export const Spacing = ({ as = "div", children, ...rest }) => {
  const TagName = as;
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
  });

  return (
    <TagName {...remainingProps} style={innerStyle}>
      {children}
    </TagName>
  );
};
