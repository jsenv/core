import { withPropsStyle } from "../props_composition/with_props_style.js";

export const consumeSpacingProps = (props) => {
  const style = {};

  // Handle margin props
  if (Object.hasOwn(props, "margin")) {
    style.margin = props.margin;
    delete props.margin;
  }

  // Handle margin directions with fallbacks
  let effectiveMarginLeft;
  let effectiveMarginRight;
  let effectiveMarginTop;
  let effectiveMarginBottom;

  if (Object.hasOwn(props, "marginLeft")) {
    effectiveMarginLeft = props.marginLeft;
    delete props.marginLeft;
  } else if (Object.hasOwn(props, "marginX")) {
    effectiveMarginLeft = props.marginX;
  }

  if (Object.hasOwn(props, "marginRight")) {
    effectiveMarginRight = props.marginRight;
    delete props.marginRight;
  } else if (Object.hasOwn(props, "marginX")) {
    effectiveMarginRight = props.marginX;
  }

  if (Object.hasOwn(props, "marginTop")) {
    effectiveMarginTop = props.marginTop;
    delete props.marginTop;
  } else if (Object.hasOwn(props, "marginY")) {
    effectiveMarginTop = props.marginY;
  }

  if (Object.hasOwn(props, "marginBottom")) {
    effectiveMarginBottom = props.marginBottom;
    delete props.marginBottom;
  } else if (Object.hasOwn(props, "marginY")) {
    effectiveMarginBottom = props.marginY;
  }

  // Delete marginX/marginY after processing specific directions
  if (Object.hasOwn(props, "marginX")) {
    delete props.marginX;
  }
  if (Object.hasOwn(props, "marginY")) {
    delete props.marginY;
  }

  // Apply effective margin values
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

  // Handle padding props
  if (Object.hasOwn(props, "padding")) {
    style.padding = props.padding;
    delete props.padding;
  }

  // Handle padding directions with fallbacks
  let effectivePaddingLeft;
  let effectivePaddingRight;
  let effectivePaddingTop;
  let effectivePaddingBottom;

  if (Object.hasOwn(props, "paddingLeft")) {
    effectivePaddingLeft = props.paddingLeft;
    delete props.paddingLeft;
  } else if (Object.hasOwn(props, "paddingX")) {
    effectivePaddingLeft = props.paddingX;
  }

  if (Object.hasOwn(props, "paddingRight")) {
    effectivePaddingRight = props.paddingRight;
    delete props.paddingRight;
  } else if (Object.hasOwn(props, "paddingX")) {
    effectivePaddingRight = props.paddingX;
  }

  if (Object.hasOwn(props, "paddingTop")) {
    effectivePaddingTop = props.paddingTop;
    delete props.paddingTop;
  } else if (Object.hasOwn(props, "paddingY")) {
    effectivePaddingTop = props.paddingY;
  }

  if (Object.hasOwn(props, "paddingBottom")) {
    effectivePaddingBottom = props.paddingBottom;
    delete props.paddingBottom;
  } else if (Object.hasOwn(props, "paddingY")) {
    effectivePaddingBottom = props.paddingY;
  }

  // Delete paddingX/paddingY after processing specific directions
  if (Object.hasOwn(props, "paddingX")) {
    delete props.paddingX;
  }
  if (Object.hasOwn(props, "paddingY")) {
    delete props.paddingY;
  }

  // Apply effective padding values
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
  const styleForSpacing = consumeSpacingProps(rest);
  return (
    <div {...rest} style={withPropsStyle(styleForSpacing, style)}>
      {children}
    </div>
  );
};
