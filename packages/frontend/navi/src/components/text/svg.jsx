import { withPropsStyle } from "../layout/with_props_style.js";

export const Svg = (props) => {
  const [remainingProps, innerStyle] = withPropsStyle(props, {
    spacing: true,
  });

  return <svg style={innerStyle} {...remainingProps} />;
};
