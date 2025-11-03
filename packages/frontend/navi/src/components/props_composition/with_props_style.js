import { appendStyles, normalizeStyles } from "@jsenv/dom";
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
  { base, layout, spacing = layout, align = layout, expansion = layout, typo },
  ...remainingConfig
) => {
  const flexDirection = useContext(FlexDirectionContext);
  const {
    // style from props
    style,
    // layout props
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
    alignX,
    alignY,
    expand,
    expandX = expand,
    expandY = expand,
    // typo props
    textSize,
    textBold,
    textThin,
    textItalic,
    textUnderline,
    textUnderlineStyle,
    textUnderlineColor,
    textColor,
    // props not related to styling
    ...remainingProps
  } = props;

  const hasRemainingConfig = remainingConfig.length > 0;
  let marginStyles;
  let paddingStyles;
  let alignmentStyles;
  let expansionStyles;
  let typoStyles;
  let propStyles;

  spacing_styles: {
    if (!spacing && !hasRemainingConfig) {
      break spacing_styles;
    }
    outer_spacing: {
      marginStyles = {};
      if (margin !== undefined) {
        marginStyles.margin = spacingSizes[margin] || margin;
      }
      if (marginLeft !== undefined) {
        marginStyles.marginLeft = spacingSizes[marginLeft] || marginLeft;
      } else if (marginX !== undefined) {
        marginStyles.marginLeft = spacingSizes[marginX] || marginX;
      }
      if (marginRight !== undefined) {
        marginStyles.marginRight = spacingSizes[marginRight] || marginRight;
      } else if (marginX !== undefined) {
        marginStyles.marginRight = spacingSizes[marginX] || marginX;
      }
      if (marginTop !== undefined) {
        marginStyles.marginTop = spacingSizes[marginTop] || marginTop;
      } else if (marginY !== undefined) {
        marginStyles.marginTop = spacingSizes[marginY] || marginY;
      }
      if (marginBottom !== undefined) {
        marginStyles.marginBottom = spacingSizes[marginBottom] || marginBottom;
      } else if (marginY !== undefined) {
        marginStyles.marginBottom = spacingSizes[marginY] || marginY;
      }
    }
    inner_spacing: {
      paddingStyles = {};
      if (padding !== undefined) {
        paddingStyles.padding = spacingSizes[padding] || padding;
      }
      if (paddingLeft !== undefined) {
        paddingStyles.paddingLeft = spacingSizes[paddingLeft] || paddingLeft;
      } else if (paddingX !== undefined) {
        paddingStyles.paddingLeft = spacingSizes[paddingX] || paddingX;
      }
      if (paddingRight !== undefined) {
        paddingStyles.paddingRight = spacingSizes[paddingRight] || paddingRight;
      } else if (paddingX !== undefined) {
        paddingStyles.paddingRight = spacingSizes[paddingX] || paddingX;
      }
      if (paddingTop !== undefined) {
        paddingStyles.paddingTop = spacingSizes[paddingTop] || paddingTop;
      } else if (paddingY !== undefined) {
        paddingStyles.paddingTop = spacingSizes[paddingY] || paddingY;
      }
      if (paddingBottom !== undefined) {
        paddingStyles.paddingBottom =
          spacingSizes[paddingBottom] || paddingBottom;
      } else if (paddingY !== undefined) {
        paddingStyles.paddingBottom = spacingSizes[paddingY] || paddingY;
      }
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
  expansion_styles: {
    if (!expansion && !hasRemainingConfig) {
      break expansion_styles;
    }
    expansionStyles = {};
    if (expandX) {
      if (flexDirection === "row") {
        expansionStyles.flexGrow = 1; // Grow horizontally in row
      } else if (flexDirection === "column") {
        expansionStyles.width = "100%"; // Take full width in column
      } else {
        expansionStyles.width = "100%"; // Take full width outside flex
      }
    }
    if (expandY) {
      if (flexDirection === "row") {
        expansionStyles.height = "100%"; // Take full height in row
      } else if (flexDirection === "column") {
        expansionStyles.flexGrow = 1; // Grow vertically in column
      } else {
        expansionStyles.height = "100%"; // Take full height outside flex
      }
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
          ? typoSizes[textSize] || textSize
          : textSize;
      typoStyles.fontSize = fontSize;
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
    typoStyles.color = textColor;
  }
  props_styles: {
    if (!style && !hasRemainingConfig) {
      break props_styles;
    }
    propStyles = style ? normalizeStyles(style, "css") : {};
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
  if (expansion) {
    Object.assign(firstConfigStyle, expansionStyles);
  }
  if (typo) {
    Object.assign(firstConfigStyle, typoStyles);
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
    if (config.expansion || config.layout) {
      Object.assign(configStyle, expansionStyles);
    }
    if (config.typo) {
      Object.assign(configStyle, typoStyles);
    }
    if (config.style) {
      appendStyles(configStyle, propStyles, "css");
    }
    result.push(configStyle);
  }
  return result;
};

// Unified design scale using t-shirt sizes with rem units for accessibility.
// This scale is used for both typography and spacing to create visual harmony
// and consistent proportions throughout the design system.
export const tshirtSizeToCSSValues = {
  xxs: "0.625rem", // 0.625 = 10px at 16px base (smaller than before for more range)
  xs: "0.75rem", // 0.75 = 12px at 16px base
  sm: "0.875rem", // 0.875 = 14px at 16px base
  md: "1rem", // 1 = 16px at 16px base (base font size)
  lg: "1.125rem", // 1.125 = 18px at 16px base
  xl: "1.25rem", // 1.25 = 20px at 16px base
  xxl: "1.5rem", // 1.5 = 24px at 16px base
};

// Typography and spacing use the same scale for consistent visual rhythm.
// When text size is "lg", using "lg" spacing creates naturally proportioned layouts.
// All values scale with user font preferences for better accessibility.
const typoSizes = tshirtSizeToCSSValues;
const spacingSizes = tshirtSizeToCSSValues;
