import { withPropsStyle } from "../props_composition/with_props_style.js";

export const Image = (props) => {
  const [remainingProps, innerStyle] = withPropsStyle(props, {
    spacing: true,
  });

  return <img style={innerStyle} {...remainingProps} />;
};
