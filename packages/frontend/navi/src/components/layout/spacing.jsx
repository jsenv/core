import { withPropsStyle } from "../props_composition/with_props_style.js";

export const consumeSpacingProps = (props) => {
  const style = {};

  // Handle margin props
  if ("margin" in props) {
    style.margin = props.margin;
    delete props.margin;
  }

  // Handle margin directions with fallbacks
  let effectiveMarginLeft;
  let effectiveMarginRight;
  let effectiveMarginTop;
  let effectiveMarginBottom;

  if ("marginLeft" in props) {
    effectiveMarginLeft = props.marginLeft;
    delete props.marginLeft;
  } else if ("marginX" in props) {
    effectiveMarginLeft = props.marginX;
  }

  if ("marginRight" in props) {
    effectiveMarginRight = props.marginRight;
    delete props.marginRight;
  } else if ("marginX" in props) {
    effectiveMarginRight = props.marginX;
  }

  if ("marginTop" in props) {
    effectiveMarginTop = props.marginTop;
    delete props.marginTop;
  } else if ("marginY" in props) {
    effectiveMarginTop = props.marginY;
  }

  if ("marginBottom" in props) {
    effectiveMarginBottom = props.marginBottom;
    delete props.marginBottom;
  } else if ("marginY" in props) {
    effectiveMarginBottom = props.marginY;
  }

  // Delete marginX/marginY after processing specific directions
  if ("marginX" in props) {
    delete props.marginX;
  }
  if ("marginY" in props) {
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
  if ("padding" in props) {
    style.padding = props.padding;
    delete props.padding;
  }

  // Handle padding directions with fallbacks
  let effectivePaddingLeft;
  let effectivePaddingRight;
  let effectivePaddingTop;
  let effectivePaddingBottom;

  if ("paddingLeft" in props) {
    effectivePaddingLeft = props.paddingLeft;
    delete props.paddingLeft;
  } else if ("paddingX" in props) {
    effectivePaddingLeft = props.paddingX;
  }

  if ("paddingRight" in props) {
    effectivePaddingRight = props.paddingRight;
    delete props.paddingRight;
  } else if ("paddingX" in props) {
    effectivePaddingRight = props.paddingX;
  }

  if ("paddingTop" in props) {
    effectivePaddingTop = props.paddingTop;
    delete props.paddingTop;
  } else if ("paddingY" in props) {
    effectivePaddingTop = props.paddingY;
  }

  if ("paddingBottom" in props) {
    effectivePaddingBottom = props.paddingBottom;
    delete props.paddingBottom;
  } else if ("paddingY" in props) {
    effectivePaddingBottom = props.paddingY;
  }

  // Delete paddingX/paddingY after processing specific directions
  if ("paddingX" in props) {
    delete props.paddingX;
  }
  if ("paddingY" in props) {
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
