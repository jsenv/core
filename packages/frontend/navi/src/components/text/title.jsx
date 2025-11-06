import { withPropsStyle } from "../layout/with_props_style.js";

export const Title = ({ as = "h1", children, ...rest }) => {
  const HeadingTag = as;
  if (rest.textBold === undefined) {
    rest.textBold = true;
  }
  const [remainingProps, innerStyle] = withPropsStyle(rest, {
    layout: true,
    typo: true,
  });

  return (
    <HeadingTag {...remainingProps} style={innerStyle}>
      {children}
    </HeadingTag>
  );
};
