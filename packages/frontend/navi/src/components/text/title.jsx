import { withPropsStyle } from "../props_composition/with_props_style.js";

export const Title = ({ children, as = "h1", ...rest }) => {
  if (rest.textBold === undefined) {
    rest.textBold = true;
  }
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });

  const HeadingTag = as;

  return (
    <HeadingTag {...remainingProps} style={innerStyle}>
      {children}
    </HeadingTag>
  );
};
