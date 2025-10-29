import { withPropsStyle } from "../props_composition/with_props_style.js";

export const consumeSpacingProps = (props) => {
  const consume = (name) => {
    if (Object.hasOwn(props, name)) {
      const value = props[name];
      delete props[name];
      return value;
    }
    return undefined;
  };
  const margin = consume("margin");
  const marginX = consume("marginX");
  const marginY = consume("marginY");
  const marginLeft = consume("marginLeft");
  const marginRight = consume("marginRight");
  const marginTop = consume("marginTop");
  const marginBottom = consume("marginBottom");

  const style = {};
  if (margin !== undefined) {
    style.margin = margin;
  }
  if (marginLeft !== undefined) {
    style.marginLeft = marginLeft;
  } else if (marginX !== undefined) {
    style.marginLeft = marginX;
  }
  if (marginRight !== undefined) {
    style.marginRight = marginRight;
  } else if (marginX !== undefined) {
    style.marginRight = marginX;
  }
  if (marginTop !== undefined) {
    style.marginTop = marginTop;
  } else if (marginY !== undefined) {
    style.marginTop = marginY;
  }
  if (marginBottom !== undefined) {
    style.marginBottom = marginBottom;
  } else if (marginY !== undefined) {
    style.marginBottom = marginY;
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
