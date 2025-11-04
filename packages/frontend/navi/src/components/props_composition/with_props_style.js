import { appendStyles, normalizeStyle, normalizeStyles } from "@jsenv/dom";
import { useContext } from "preact/hooks";

import { FlexDirectionContext } from "../layout/layout_context.jsx";

/**
 * Processes component props to extract and generate styles for layout, spacing, alignment, expansion, and typography.
 * Returns remaining props and styled objects based on configuration.
 *
 * ```jsx
 * const MyButton = (props) => {
 *   const [remainingProps, style] = withPropsStyle(props, {
 *     base: { padding: 10, backgroundColor: 'blue' },
 *     layout: true, // Enable spacing, alignment, and expansion props
 *     typo: true,   // Enable typography props
 *   });
 *   return <button style={style} {...remainingProps}>{props.children}</button>;
 * };
 *
 * // Usage:
 * <MyButton margin={10} expandX alignX="center" color="white">Click me</MyButton>
 * <MyButton paddingX={20} bold style={{ border: '1px solid red' }}>Bold button</MyButton>
 * ```
 *
 * ## Advanced: Multiple Style Objects
 *
 * You can generate additional style objects with different configurations:
 *
 * ```jsx
 * const [remainingProps, mainStyle, layoutOnlyStyle] = withPropsStyle(props, {
 *   base: { color: 'blue' },
 *   layout: true,
 *   typo: true,
 * }, {
 *   layout: true,  // Second style object with only layout styles
 * });
 * ```
 *
 * @param {object} props - Component props including style and layout props
 * @param {object} config - Main configuration for which style categories to process
 * @param {string|object} [config.base] - Base styles to apply first
 * @param {boolean} [config.layout] - Enable all layout props (shorthand for spacing, align, expansion)
 * @param {boolean} [config.spacing] - Enable margin/padding props
 * @param {boolean} [config.align] - Enable alignment props (alignX, alignY)
 * @param {boolean} [config.expansion] - Enable expansion props (expandX, expandY)
 * @param {boolean} [config.typo] - Enable typography props (color, bold, italic, etc.)
 * @param {...object} remainingConfig - Additional configuration objects for generating separate style objects
 * @param {boolean|object} [remainingConfig.base] - Include base styles (true for main base, or custom base object)
 * @param {boolean} [remainingConfig.style] - Include styles from props in this config
 * @returns {array} [remainingProps, mainStyle, ...additionalStyles] - Non-style props and style objects
 */
export const withPropsStyle = (
  props,
  {
    base,
    layout,
    spacing = layout,
    align = layout,
    size = layout,
    typo,
    visual = true,
  },
  ...remainingConfig
) => {
  const flexDirection = useContext(FlexDirectionContext);
  const {
    // style from props
    style,

    // layout props
    // layout/spacing
    margin,
    marginX,
    marginY,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    padding,
    paddingX,
    paddingY,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    // layout/alignment
    alignX,
    alignY,
    // layout/size
    expand,
    expandX = expand,
    expandY = expand,
    width,
    minWidth,
    maxWidth,
    height,
    minHeight,
    maxHeight,

    // typo props
    textSize,
    textBold,
    textThin,
    textItalic,
    textUnderline,
    textUnderlineStyle,
    textUnderlineColor,
    textColor,
    textShadow,
    textLineHeight,

    // visual props
    boxShadow,
    background,
    backgroundColor,
    backgroundImage,
    backgroundSize,
    border,
    borderWidth,
    borderRadius,
    borderColor,
    borderStyle,
    borderTop,
    borderLeft,
    borderRight,
    borderBottom,
    opacity,
    filter,

    // props not related to styling
    ...remainingProps
  } = props;

  const hasRemainingConfig = remainingConfig.length > 0;
  let propStyles;
  let marginStyles;
  let paddingStyles;
  let alignmentStyles;
  let sizeStyles;
  let typoStyles;
  let visualStyles;

  props_styles: {
    if (!style && !hasRemainingConfig) {
      break props_styles;
    }
    propStyles = style ? normalizeStyles(style, "css") : {};
  }
  spacing_styles: {
    if (!spacing && !hasRemainingConfig) {
      break spacing_styles;
    }
    outer_spacing: {
      marginStyles = {};
      if (margin !== undefined) {
        marginStyles.margin = sizeSpacingScale[margin] || margin;
      }
      if (marginLeft !== undefined) {
        marginStyles.marginLeft = sizeSpacingScale[marginLeft] || marginLeft;
      } else if (marginX !== undefined) {
        marginStyles.marginLeft = sizeSpacingScale[marginX] || marginX;
      }
      if (marginRight !== undefined) {
        marginStyles.marginRight = sizeSpacingScale[marginRight] || marginRight;
      } else if (marginX !== undefined) {
        marginStyles.marginRight = sizeSpacingScale[marginX] || marginX;
      }
      if (marginTop !== undefined) {
        marginStyles.marginTop = sizeSpacingScale[marginTop] || marginTop;
      } else if (marginY !== undefined) {
        marginStyles.marginTop = sizeSpacingScale[marginY] || marginY;
      }
      if (marginBottom !== undefined) {
        marginStyles.marginBottom =
          sizeSpacingScale[marginBottom] || marginBottom;
      } else if (marginY !== undefined) {
        marginStyles.marginBottom = sizeSpacingScale[marginY] || marginY;
      }
      normalizeStyles(marginStyles, "css", true);
    }
    inner_spacing: {
      paddingStyles = {};
      if (padding !== undefined) {
        paddingStyles.padding = sizeSpacingScale[padding] || padding;
      }
      if (paddingLeft !== undefined) {
        paddingStyles.paddingLeft =
          sizeSpacingScale[paddingLeft] || paddingLeft;
      } else if (paddingX !== undefined) {
        paddingStyles.paddingLeft = sizeSpacingScale[paddingX] || paddingX;
      }
      if (paddingRight !== undefined) {
        paddingStyles.paddingRight =
          sizeSpacingScale[paddingRight] || paddingRight;
      } else if (paddingX !== undefined) {
        paddingStyles.paddingRight = sizeSpacingScale[paddingX] || paddingX;
      }
      if (paddingTop !== undefined) {
        paddingStyles.paddingTop = sizeSpacingScale[paddingTop] || paddingTop;
      } else if (paddingY !== undefined) {
        paddingStyles.paddingTop = sizeSpacingScale[paddingY] || paddingY;
      }
      if (paddingBottom !== undefined) {
        paddingStyles.paddingBottom =
          sizeSpacingScale[paddingBottom] || paddingBottom;
      } else if (paddingY !== undefined) {
        paddingStyles.paddingBottom = sizeSpacingScale[paddingY] || paddingY;
      }
      normalizeStyles(paddingStyles, "css", true);
    }
  }
  alignment_styles: {
    if (!align && !hasRemainingConfig) {
      break alignment_styles;
    }
    alignmentStyles = {};

    // flex
    if (flexDirection === "row") {
      // In row direction: alignX controls justify-content, alignY controls align-self
      if (alignY !== undefined && alignY !== "start") {
        alignmentStyles.alignSelf = alignY;
      }
      // For row, alignX uses auto margins for positioning
      // NOTE: Auto margins only work effectively for positioning individual items.
      // When multiple adjacent items have the same auto margin alignment (e.g., alignX="end"),
      // only the first item will be positioned as expected because subsequent items
      // will be positioned relative to the previous item's margins, not the container edge.
      if (alignX !== undefined) {
        if (alignX === "start") {
          alignmentStyles.marginRight = "auto";
        } else if (alignX === "end") {
          alignmentStyles.marginLeft = "auto";
        } else if (alignX === "center") {
          alignmentStyles.marginLeft = "auto";
          alignmentStyles.marginRight = "auto";
        }
      }
    } else if (flexDirection === "column") {
      // In column direction: alignX controls align-self, alignY uses auto margins
      if (alignX !== undefined && alignX !== "start") {
        alignmentStyles.alignSelf = alignX;
      }
      // For column, alignY uses auto margins for positioning
      // NOTE: Same auto margin limitation applies - multiple adjacent items with
      // the same alignY won't all position relative to container edges.
      if (alignY !== undefined) {
        if (alignY === "start") {
          alignmentStyles.marginBottom = "auto";
        } else if (alignY === "end") {
          alignmentStyles.marginTop = "auto";
        } else if (alignY === "center") {
          alignmentStyles.marginTop = "auto";
          alignmentStyles.marginBottom = "auto";
        }
      }
    }
    // non flex
    else {
      if (alignX === "start") {
        alignmentStyles.marginRight = "auto";
      } else if (alignX === "center") {
        alignmentStyles.marginLeft = "auto";
        alignmentStyles.marginRight = "auto";
      } else if (alignX === "end") {
        alignmentStyles.marginLeft = "auto";
      }

      if (alignY === "start") {
        alignmentStyles.marginBottom = "auto";
      } else if (alignY === "center") {
        alignmentStyles.marginTop = "auto";
        alignmentStyles.marginBottom = "auto";
      } else if (alignY === "end") {
        alignmentStyles.marginTop = "auto";
      }
    }
  }
  size_styles: {
    if (!size && !hasRemainingConfig) {
      break size_styles;
    }
    sizeStyles = {};
    if (expandX) {
      if (flexDirection === "row") {
        sizeStyles.flexGrow = 1; // Grow horizontally in row
      } else if (flexDirection === "column") {
        sizeStyles.width = "100%"; // Take full width in column
      } else {
        sizeStyles.width = "100%"; // Take full width outside flex
      }
    } else if (width !== undefined) {
      sizeStyles.width = normalizeStyle(width, "width", "css");
    }
    if (minWidth !== undefined) {
      sizeStyles.minWidth = normalizeStyle(minWidth, "minWidth", "css");
    }
    if (maxWidth !== undefined) {
      sizeStyles.maxWidth = normalizeStyle(maxWidth, "maxWidth", "css");
    }
    if (expandY) {
      if (flexDirection === "row") {
        sizeStyles.height = "100%"; // Take full height in row
      } else if (flexDirection === "column") {
        sizeStyles.flexGrow = 1; // Grow vertically in column
      } else {
        sizeStyles.height = "100%"; // Take full height outside flex
      }
    } else if (height !== undefined) {
      sizeStyles.height = normalizeStyle(height, "height", "css");
    }
    if (minHeight !== undefined) {
      sizeStyles.minHeight = normalizeStyle(minHeight, "minHeight", "css");
    }
    if (maxHeight !== undefined) {
      sizeStyles.maxHeight = normalizeStyle(maxHeight, "maxHeight", "css");
    }
  }
  typo_styles: {
    if (!typo && !hasRemainingConfig) {
      break typo_styles;
    }
    typoStyles = {};

    if (textSize) {
      const fontSize =
        typeof textSize === "string"
          ? sizeTypoScale[textSize] || textSize
          : textSize;
      typoStyles.fontSize = normalizeStyle(fontSize, "fontSize", "css");
    }
    if (textBold) {
      typoStyles.fontWeight = "bold";
    } else if (textThin) {
      typoStyles.fontWeight = "thin";
    } else if (textThin === false || textBold === false) {
      typoStyles.fontWeight = "normal";
    }
    if (textItalic) {
      typoStyles.fontStyle = "italic";
    } else if (textItalic === false) {
      typoStyles.fontStyle = "normal";
    }
    if (textUnderline) {
      typoStyles.textDecoration = "underline";
    } else if (textUnderline === false) {
      typoStyles.textDecoration = "none";
    }
    if (textUnderlineStyle) {
      typoStyles.textDecorationStyle = textUnderlineStyle;
    }
    if (textUnderlineColor) {
      typoStyles.textDecorationColor = textUnderlineColor;
    }
    if (textShadow) {
      typoStyles.textShadow = textShadow;
    }
    if (textLineHeight !== undefined) {
      typoStyles.lineHeight = normalizeStyle(
        sizeTypoScale[textLineHeight] || textLineHeight,
        "lineHeight",
        "css",
      );
    }
    typoStyles.color = textColor;
  }
  visual_styles: {
    if (!visual && !hasRemainingConfig) {
      break visual_styles;
    }
    visualStyles = {};
    if (boxShadow !== undefined) {
      visualStyles.boxShadow = boxShadow;
    }
    if (background !== undefined) {
      visualStyles.background = background;
    }
    if (backgroundColor !== undefined) {
      visualStyles.backgroundColor = backgroundColor;
    }
    if (backgroundImage !== undefined) {
      visualStyles.backgroundImage = normalizeStyle(
        backgroundImage,
        "backgroundImage",
        "css",
      );
    }
    if (backgroundSize !== undefined) {
      visualStyles.backgroundSize = backgroundSize;
    }
    if (border !== undefined) {
      visualStyles.border = border;
    }
    if (borderTop !== undefined) {
      visualStyles.borderTop = borderTop;
    }
    if (borderLeft !== undefined) {
      visualStyles.borderLeft = borderLeft;
    }
    if (borderRight !== undefined) {
      visualStyles.borderRight = borderRight;
    }
    if (borderBottom !== undefined) {
      visualStyles.borderBottom = borderBottom;
    }
    if (borderWidth !== undefined) {
      visualStyles.borderWidth = normalizeStyle(
        sizeSpacingScale[borderWidth] || borderWidth,
        "borderWidth",
        "css",
      );
    }
    if (borderRadius !== undefined) {
      visualStyles.borderRadius = normalizeStyle(
        sizeSpacingScale[borderRadius] || borderRadius,
        "borderRadius",
        "css",
      );
    }
    if (borderColor !== undefined) {
      visualStyles.borderColor = borderColor;
    }
    if (borderStyle !== undefined) {
      visualStyles.borderStyle = borderStyle;
    }
    if (opacity !== undefined) {
      visualStyles.opacity = opacity;
    }
    if (filter !== undefined) {
      visualStyles.filter = filter;
    }
  }

  const firstConfigStyle = {};
  if (base) {
    Object.assign(firstConfigStyle, base);
  }
  if (spacing) {
    Object.assign(firstConfigStyle, marginStyles, paddingStyles);
  }
  if (align) {
    Object.assign(firstConfigStyle, alignmentStyles);
  }
  if (size) {
    Object.assign(firstConfigStyle, sizeStyles);
  }
  if (typo) {
    Object.assign(firstConfigStyle, typoStyles);
  }
  if (visual) {
    Object.assign(firstConfigStyle, visualStyles);
  }
  if (style) {
    appendStyles(firstConfigStyle, propStyles, "css");
  }
  const result = [remainingProps, firstConfigStyle];

  for (const config of remainingConfig) {
    const configStyle = {};
    if (config.base === true) {
      Object.assign(configStyle, base);
    } else if (typeof config.base === "object") {
      Object.assign(configStyle, config.base);
    }
    if (config.spacing || config.layout) {
      Object.assign(configStyle, marginStyles, paddingStyles);
    }
    if (config.align || config.layout) {
      Object.assign(configStyle, alignmentStyles);
    }
    if (config.size || config.layout) {
      Object.assign(configStyle, sizeStyles);
    }
    if (config.typo) {
      Object.assign(configStyle, typoStyles);
    }
    if (config.visual || config.visual === undefined) {
      Object.assign(configStyle, visualStyles);
    }
    if (config.style) {
      appendStyles(configStyle, propStyles, "css");
    }
    result.push(configStyle);
  }
  return result;
};

// Unified design scale using t-shirt sizes with rem units for accessibility.
// This scale is used for spacing to create visual harmony
// and consistent proportions throughout the design system.
export const sizeSpacingScale = {
  xxs: "0.125rem", // 0.125 = 2px at 16px base
  xs: "0.25rem", // 0.25 = 4px at 16px base
  sm: "0.5rem", // 0.5 = 8px at 16px base
  md: "1rem", // 1 = 16px at 16px base (base font size)
  lg: "1.5rem", // 1.5 = 24px at 16px base
  xl: "2rem", // 2 = 32px at 16px base
  xxl: "3rem", // 3 = 48px at 16px base
};
export const sizeTypoScale = {
  xxs: "0.625rem", // 0.625 = 10px at 16px base (smaller than before for more range)
  xs: "0.75rem", // 0.75 = 12px at 16px base
  sm: "0.875rem", // 0.875 = 14px at 16px base
  md: "1rem", // 1 = 16px at 16px base (base font size)
  lg: "1.125rem", // 1.125 = 18px at 16px base
  xl: "1.25rem", // 1.25 = 20px at 16px base
  xxl: "1.5rem", // 1.5 = 24px at 16px base
};
