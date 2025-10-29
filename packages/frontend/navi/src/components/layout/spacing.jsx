export const getStyleForSpacingProps = ({
  margin,
  marginX,
  marginY,
  marginLeft,
  marginTop,
  marginBottom,
  marginRight,
}) => {
  const style = {};

  margin_styles: {
    // If margin is explicitly set, use it
    if (margin !== undefined) {
      style.margin = margin;
    } else {
      const effectiveMarginLeft = marginLeft ?? marginX;
      const effectiveMarginRight = marginRight ?? marginX;
      const effectiveMarginTop = marginTop ?? marginY;
      const effectiveMarginBottom = marginBottom ?? marginY;

      // Otherwise, set individual margins only if they're defined
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
    }
  }

  return style;
};
