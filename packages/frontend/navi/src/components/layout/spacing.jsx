import { withPropsStyle } from "../props_composition/with_props_style.js";

export const consumeSpacingProps = (props) => {
  const style = {};

  outer_spacing: {
    const margin = props.margin;
    const marginX = props.marginX;
    const marginY = props.marginY;
    const marginLeft = props.marginLeft;
    const marginRight = props.marginRight;
    const marginTop = props.marginTop;
    const marginBottom = props.marginBottom;
    delete props.margin;
    delete props.marginX;
    delete props.marginY;
    delete props.marginLeft;
    delete props.marginRight;
    delete props.marginTop;
    delete props.marginBottom;

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
  }

  inner_spacing: {
    const padding = props.padding;
    const paddingX = props.paddingX;
    const paddingY = props.paddingY;
    const paddingLeft = props.paddingLeft;
    const paddingRight = props.paddingRight;
    const paddingTop = props.paddingTop;
    const paddingBottom = props.paddingBottom;
    delete props.padding;
    delete props.paddingX;
    delete props.paddingY;
    delete props.paddingLeft;
    delete props.paddingRight;
    delete props.paddingTop;
    delete props.paddingBottom;

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
