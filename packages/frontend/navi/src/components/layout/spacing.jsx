import { withPropsStyle } from "../props_composition/with_props_style.js";

export const getStyleForSpacingProps = ({
  margin,
  marginX,
  marginY,
  marginLeft,
  marginTop,
  marginBottom,
  marginRight,
  padding,
  paddingX,
  paddingY,
  paddingLeft,
  paddingTop,
  paddingBottom,
  paddingRight,
}) => {
  const style = {};

  if (margin !== undefined) {
    style.margin = margin;
  }
  const effectiveMarginLeft = marginLeft ?? marginX;
  const effectiveMarginRight = marginRight ?? marginX;
  const effectiveMarginTop = marginTop ?? marginY;
  const effectiveMarginBottom = marginBottom ?? marginY;

  if (effectiveMarginLeft !== undefined) {
    style.marginLeft = effectiveMarginLeft;
  }
  if (effectiveMarginRight !== undefined) {
    style.marginRight = effectiveMarginRight;
  }
  if (effectiveMarginTop !== undefined) {
    style.marginTop = effectiveMarginTop;
  }
  if (effectiveMarginBottom !== undefined) {
    style.marginBottom = effectiveMarginBottom;
  }

  if (padding !== undefined) {
    style.padding = padding;
  }
  const effectivePaddingLeft = paddingLeft ?? paddingX;
  const effectivePaddingRight = paddingRight ?? paddingX;
  const effectivePaddingTop = paddingTop ?? paddingY;
  const effectivePaddingBottom = paddingBottom ?? paddingY;
  if (effectivePaddingLeft !== undefined) {
    style.paddingLeft = effectivePaddingLeft;
  }
  if (effectivePaddingRight !== undefined) {
    style.paddingRight = effectivePaddingRight;
  }
  if (effectivePaddingTop !== undefined) {
    style.paddingTop = effectivePaddingTop;
  }
  if (effectivePaddingBottom !== undefined) {
    style.paddingBottom = effectivePaddingBottom;
  }

  return style;
};

export const Spacing = ({ style, children, ...rest }) => {
  const styleForSpacing = getStyleForSpacingProps(rest);
  return <div style={withPropsStyle(styleForSpacing, style)}>{children}</div>;
};
