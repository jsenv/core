import { normalizeStyle } from "@jsenv/dom";

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

export const normalizeSpacingStyle = (value, property = "padding") => {
  const cssSize = sizeSpacingScale[value];
  return cssSize || normalizeStyle(value, property, "css");
};
export const normalizeTypoStyle = (value, property = "fontSize") => {
  const cssSize = sizeTypoScale[value];
  return cssSize || normalizeStyle(value, property, "css");
};
export const normalizeCssStyle = (value, property) => {
  return normalizeStyle(value, property, "css");
};

const PASS_THROUGH = { name: "pass_through" };
const applyOnCSSProp = (cssStyle) => {
  return (value) => {
    return { [cssStyle]: value };
  };
};
const applyOnTwoCSSProps = (cssStyleA, cssStyleB) => {
  return (value) => {
    return {
      [cssStyleA]: value,
      [cssStyleB]: value,
    };
  };
};
const applyToCssPropWhenTruthy = (
  cssProp,
  cssPropValue,
  cssPropValueOtherwise,
) => {
  return (value) => {
    if (!value) {
      if (cssPropValueOtherwise === undefined) {
        return null;
      }
      if (value === undefined) {
        return null;
      }
      return { [cssProp]: cssPropValueOtherwise };
    }
    return { [cssProp]: cssPropValue };
  };
};
const applyOnTwoProps = (propA, propB) => {
  return (value, context) => {
    const firstProp = All_PROPS[propA];
    const secondProp = All_PROPS[propB];
    const firstPropResult = firstProp(value, context);
    const secondPropResult = secondProp(value, context);
    if (firstPropResult && secondPropResult) {
      return {
        ...firstPropResult,
        ...secondPropResult,
      };
    }
    return firstPropResult || secondPropResult;
  };
};

const OUTER_SPACING_PROPS = {
  margin: PASS_THROUGH,
  marginLeft: PASS_THROUGH,
  marginRight: PASS_THROUGH,
  marginTop: PASS_THROUGH,
  marginBottom: PASS_THROUGH,
  marginX: applyOnTwoCSSProps("marginLeft", "marginRight"),
  marginY: applyOnTwoCSSProps("marginTop", "marginBottom"),
};
const INNER_SPACING_PROPS = {
  padding: PASS_THROUGH,
  paddingLeft: PASS_THROUGH,
  paddingRight: PASS_THROUGH,
  paddingTop: PASS_THROUGH,
  paddingBottom: PASS_THROUGH,
  paddingX: applyOnTwoCSSProps("paddingLeft", "paddingRight"),
  paddingY: applyOnTwoCSSProps("paddingTop", "paddingBottom"),
};
const DIMENSION_PROPS = {
  width: PASS_THROUGH,
  minWidth: PASS_THROUGH,
  maxWidth: PASS_THROUGH,
  height: PASS_THROUGH,
  minHeight: PASS_THROUGH,
  maxHeight: PASS_THROUGH,
  expand: applyOnTwoProps("expandX", "expandY"),
  shrink: applyOnTwoProps("shrinkX", "shrinkY"),
  // apply after width/height to override if both are set
  expandX: (value, { parentLayout }) => {
    if (!value) {
      return null;
    }
    if (parentLayout === "column" || parentLayout === "inline-column") {
      return { flexGrow: 1 }; // Grow horizontally in row
    }
    if (parentLayout === "row") {
      return { minWidth: "100%" }; // Take full width in column
    }
    return { minWidth: "100%" }; // Take full width outside flex
  },
  expandY: (value, { parentLayout }) => {
    if (!value) {
      return null;
    }
    if (parentLayout === "column") {
      return { minHeight: "100%" }; // Make column full height
    }
    if (parentLayout === "row" || parentLayout === "inline-row") {
      return { flexGrow: 1 }; // Make row full height
    }
    return { minHeight: "100%" }; // Take full height outside flex
  },
  shrinkX: (value, { parentLayout }) => {
    if (!value) {
      return null;
    }
    if (parentLayout === "row" || parentLayout === "inline-row") {
      return { flexShrink: 1 };
    }
    return { maxWidth: "100%" };
  },
  shrinkY: (value, { parentLayout }) => {
    if (!value) {
      return null;
    }
    if (parentLayout === "column" || parentLayout === "inline-column") {
      return { flexShrink: 1 };
    }
    return { maxHeight: "100%" };
  },
};
const POSITION_PROPS = {
  // For row, alignX uses auto margins for positioning
  // NOTE: Auto margins only work effectively for positioning individual items.
  // When multiple adjacent items have the same auto margin alignment (e.g., alignX="end"),
  // only the first item will be positioned as expected because subsequent items
  // will be positioned relative to the previous item's margins, not the container edge.
  alignX: (value, { parentLayout }) => {
    const insideRowLayout =
      parentLayout === "row" || parentLayout === "inline-row";

    if (value === "start") {
      if (insideRowLayout) {
        return { alignSelf: "start" };
      }
      return { marginRight: "auto" };
    }
    if (value === "end") {
      if (insideRowLayout) {
        return { alignSelf: "end" };
      }
      return { marginLeft: "auto" };
    }
    if (value === "center") {
      if (insideRowLayout) {
        return { alignSelf: "center" };
      }
      return { marginLeft: "auto", marginRight: "auto" };
    }
    if (insideRowLayout && value !== "stretch") {
      return { alignSelf: value };
    }
    return undefined;
  },
  alignY: (value, { parentLayout }) => {
    const inlineColumnLayout =
      parentLayout === "column" || parentLayout === "inline-column";

    if (value === "start") {
      if (inlineColumnLayout) {
        return undefined; // this is the default
      }
      return { marginBottom: "auto" };
    }
    if (value === "center") {
      if (inlineColumnLayout) {
        return { alignSelf: "center" };
      }
      return { marginTop: "auto", marginBottom: "auto" };
    }
    if (value === "end") {
      if (inlineColumnLayout) {
        return { alignSelf: "end" };
      }
      return { marginTop: "auto" };
    }
    return undefined;
  },
  left: PASS_THROUGH,
  top: PASS_THROUGH,
};
const TYPO_PROPS = {
  size: applyOnCSSProp("fontSize"),
  fontSize: PASS_THROUGH,
  bold: applyToCssPropWhenTruthy("fontWeight", "bold", "normal"),
  think: applyToCssPropWhenTruthy("fontWeight", "thin", "normal"),
  italic: applyToCssPropWhenTruthy("fontStyle", "italic", "normal"),
  underline: applyToCssPropWhenTruthy("textDecoration", "underline", "none"),
  underlineStyle: applyOnCSSProp("textDecorationStyle"),
  underlineColor: applyOnCSSProp("textDecorationColor"),
  textShadow: PASS_THROUGH,
  lineHeight: PASS_THROUGH,
  color: PASS_THROUGH,
  noWrap: applyToCssPropWhenTruthy("whiteSpace", "nowrap", "normal"),
  pre: applyToCssPropWhenTruthy("whiteSpace", "pre", "normal"),
  preWrap: applyToCssPropWhenTruthy("whiteSpace", "pre-wrap", "normal"),
};
const VISUAL_PROPS = {
  boxShadow: PASS_THROUGH,
  background: PASS_THROUGH,
  backgroundColor: PASS_THROUGH,
  backgroundImage: PASS_THROUGH,
  backgroundSize: PASS_THROUGH,
  border: PASS_THROUGH,
  borderTop: PASS_THROUGH,
  borderLeft: PASS_THROUGH,
  borderRight: PASS_THROUGH,
  borderBottom: PASS_THROUGH,
  borderWidth: PASS_THROUGH,
  borderRadius: PASS_THROUGH,
  borderColor: PASS_THROUGH,
  borderStyle: PASS_THROUGH,
  opacity: PASS_THROUGH,
  filter: PASS_THROUGH,
  cursor: PASS_THROUGH,
};
const CONTENT_PROPS = {
  contentAlignX: (value, { layout }) => {
    if (layout === "row" || layout === "inline-row") {
      if (value === "stretch") {
        return undefined; // this is the default
      }
      return { alignItems: value };
    }
    if (layout === "column" || layout === "inline-column") {
      if (value === "start") {
        return undefined; // this is the default
      }
      return { justifyContent: value };
    }
    if (layout === "inline-block" || layout === "table-cell") {
      if (value === "start") {
        return undefined; // this is the default
      }
      return { textAlign: value };
    }
    return undefined;
  },
  contentAlignY: (value, { layout }) => {
    if (layout === "row" || layout === "inline-row") {
      if (value === "start") {
        return undefined;
      }
      return {
        justifyContent: value,
      };
    }
    if (layout === "column" || layout === "inline-column") {
      if (value === "stretch") {
        return undefined;
      }
      return { alignItems: value };
    }
    if (layout === "inline-block" || layout === "table-cell") {
      if (value === "start") {
        return undefined;
      }
      return { verticalAlign: value };
    }
    return undefined;
  },
  contentSpacing: (value, { layout }) => {
    if (
      layout === "row" ||
      layout === "column"
      // layout === "inline-row" ||
      // layout === "inline-column"
    ) {
      return {
        gap: resolveSpacingSize(value, "gap"),
      };
    }
    return undefined;
  },
};
const All_PROPS = {
  ...OUTER_SPACING_PROPS,
  ...INNER_SPACING_PROPS,
  ...DIMENSION_PROPS,
  ...POSITION_PROPS,
  ...TYPO_PROPS,
  ...VISUAL_PROPS,
  ...CONTENT_PROPS,
};
const OUTER_SPACING_PROP_NAME_SET = new Set(Object.keys(OUTER_SPACING_PROPS));
const INNER_SPACING_PROP_NAME_SET = new Set(Object.keys(INNER_SPACING_PROPS));
const DIMENSION_PROP_NAME_SET = new Set(Object.keys(DIMENSION_PROPS));
const POSITION_PROP_NAME_SET = new Set(Object.keys(POSITION_PROPS));
const TYPO_PROP_NAME_SET = new Set(Object.keys(TYPO_PROPS));
const VISUAL_PROP_NAME_SET = new Set(Object.keys(VISUAL_PROPS));
const CONTENT_PROP_NAME_SET = new Set(Object.keys(CONTENT_PROPS));
const STYLE_PROP_NAME_SET = new Set(Object.keys(All_PROPS));

export const HANDLED_BY_VISUAL_CHILD_PROP_SET = new Set([
  ...INNER_SPACING_PROP_NAME_SET,
  ...VISUAL_PROP_NAME_SET,
  ...CONTENT_PROP_NAME_SET,
]);
export const COPIED_ON_VISUAL_CHILD_PROP_SET = new Set([
  "expand",
  "shrink",
  "expandX",
  "expandY",
  "contentAlignX",
  "contentAlignY",
]);

export const isStyleProp = (name) => STYLE_PROP_NAME_SET.has(name);

const getStylePropGroup = (name) => {
  if (OUTER_SPACING_PROP_NAME_SET.has(name)) {
    return "margin";
  }
  if (INNER_SPACING_PROP_NAME_SET.has(name)) {
    return "padding";
  }
  if (DIMENSION_PROP_NAME_SET.has(name)) {
    return "dimension";
  }
  if (POSITION_PROP_NAME_SET.has(name)) {
    return "position";
  }
  if (TYPO_PROP_NAME_SET.has(name)) {
    return "typo";
  }
  if (VISUAL_PROP_NAME_SET.has(name)) {
    return "visual";
  }
  if (CONTENT_PROP_NAME_SET.has(name)) {
    return "content";
  }
  return null;
};
const getNormalizer = (key) => {
  const group = getStylePropGroup(key);
  if (group === "margin" || group === "padding") {
    return normalizeSpacingStyle;
  }
  if (group === "typo") {
    return normalizeTypoStyle;
  }
  return normalizeCssStyle;
};

export const assignStyle = (
  styleObject,
  propValue,
  propName,
  styleContext,
  normalizer = getNormalizer(propName),
) => {
  if (propValue === undefined) {
    return;
  }
  const { managedByCSSVars } = styleContext;
  if (!managedByCSSVars) {
    throw new Error("managedByCSSVars is required in styleContext");
  }
  const getStyle = All_PROPS[propName];
  if (
    getStyle === PASS_THROUGH ||
    // style not listed can be passed through as-is (accentColor, zIndex, ...)
    getStyle === undefined
  ) {
    const cssValue = normalizer(propValue, propName);
    const cssVar = managedByCSSVars[propName];
    if (cssVar) {
      styleObject[cssVar] = cssValue;
    } else {
      styleObject[propName] = cssValue;
    }
    return;
  }
  const values = getStyle(propValue, styleContext);
  if (!values) {
    return;
  }
  for (const key of Object.keys(values)) {
    const value = values[key];
    const cssValue = normalizer(value, key);
    const cssVar = managedByCSSVars[key];
    if (cssVar) {
      styleObject[cssVar] = cssValue;
    } else {
      styleObject[key] = cssValue;
    }
  }
};

// Unified design scale using t-shirt sizes with rem units for accessibility.
// This scale is used for spacing to create visual harmony
// and consistent proportions throughout the design system.
const sizeSpacingScale = {
  xxs: "0.125em", // 0.125 = 2px at 16px base
  xs: "0.25em", // 0.25 = 4px at 16px base
  sm: "0.5em", // 0.5 = 8px at 16px base
  md: "1em", // 1 = 16px at 16px base (base font size)
  lg: "1.5em", // 1.5 = 24px at 16px base
  xl: "2em", // 2 = 32px at 16px base
  xxl: "3em", // 3 = 48px at 16px base
};
export const resolveSpacingSize = (
  size,
  property = "padding",
  context = "css",
) => {
  return normalizeStyle(sizeSpacingScale[size] || size, property, context);
};

const sizeTypoScale = {
  xxs: "0.625em", // 0.625 = 10px at 16px base (smaller than before for more range)
  xs: "0.75em", // 0.75 = 12px at 16px base
  sm: "0.875em", // 0.875 = 14px at 16px base
  md: "1em", // 1 = 16px at 16px base (base font size)
  lg: "1.125em", // 1.125 = 18px at 16px base
  xl: "1.25em", // 1.25 = 20px at 16px base
  xxl: "1.5em", // 1.5 = 24px at 16px base
};
export const resolveTypoSize = (
  size,
  property = "fontSize",
  context = "css",
) => {
  return normalizeStyle(sizeTypoScale[size] || size, property, context);
};
