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

  const padding = consume("padding");
  const paddingX = consume("paddingX");
  const paddingY = consume("paddingY");
  const paddingLeft = consume("paddingLeft");
  const paddingRight = consume("paddingRight");
  const paddingTop = consume("paddingTop");
  const paddingBottom = consume("paddingBottom");

  if (padding !== undefined) {
    style.padding = padding;
  }
  if (paddingLeft !== undefined) {
    style.paddingLeft = paddingLeft;
  } else if (paddingX !== undefined) {
    style.paddingLeft = paddingX;
  }
  if (paddingRight !== undefined) {
    style.paddingRight = paddingRight;
  } else if (paddingX !== undefined) {
    style.paddingRight = paddingX;
  }
  if (paddingTop !== undefined) {
    style.paddingTop = paddingTop;
  } else if (paddingY !== undefined) {
    style.paddingTop = paddingY;
  }
  if (paddingBottom !== undefined) {
    style.paddingBottom = paddingBottom;
  } else if (paddingY !== undefined) {
    style.paddingBottom = paddingY;
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
