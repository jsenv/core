import { withPropsStyle } from "../props_composition/with_props_style.js";

export const Paragraph = ({ children, ...rest }) => {
  if (rest.marginTop === undefined) {
    rest.marginTop = "md";
  }
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });

  return (
    <p {...remainingProps} style={innerStyle}>
      {children}
    </p>
  );
};
