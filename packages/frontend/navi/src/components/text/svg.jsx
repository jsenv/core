import { withPropsStyle } from "../props_composition/with_props_style.js";

export const Svg = (props) => {
  const [remainingProps, innerStyle] = withPropsStyle(props, {
    spacing: true,
  });

  return <svg style={innerStyle} {...remainingProps} />;
};
