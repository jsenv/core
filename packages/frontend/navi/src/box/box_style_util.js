import { mergeOneStyle, stringifyStyle } from "@jsenv/dom";

export const normalizeSpacingStyle = (value, property = "padding") => {
  const cssSize = sizeSpacingScale[value];
  return cssSize || stringifyStyle(value, property);
};
export const normalizeTypoStyle = (value, property = "fontSize") => {
  const cssSize = sizeTypoScale[value];
  return cssSize || stringifyStyle(value, property);
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
  return (value, styleContext) => {
    if (value) {
      return { [cssProp]: cssPropValue };
    }
    if (cssPropValueOtherwise === undefined) {
      return null;
    }
    if (value === undefined) {
      return null;
    }
    if (styleContext.styles[cssProp] !== undefined) {
      // keep any value previously set
      return null;
    }
    return { [cssProp]: cssPropValueOtherwise };
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

const FLOW_PROPS = {
  // all are handled by data-attributes
  inline: () => {},
  box: () => {},
  row: () => {},
  column: () => {},

  absolute: applyToCssPropWhenTruthy("position", "absolute", "static"),
  relative: applyToCssPropWhenTruthy("position", "relative", "static"),
  fixed: applyToCssPropWhenTruthy("position", "fixed", "static"),
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
  square: (v) => {
    if (!v) {
      return null;
    }
    return {
      aspectRatio: "1/1",
    };
  },
  circle: (v) => {
    if (!v) {
      return null;
    }
    return {
      aspectRatio: "1/1",
      borderRadius: "100%",
    };
  },
  expand: applyOnTwoProps("expandX", "expandY"),
  shrink: applyOnTwoProps("shrinkX", "shrinkY"),
  // apply after width/height to override if both are set
  expandX: (value, { parentBoxFlow }) => {
    if (!value) {
      return null;
    }
    if (parentBoxFlow === "column" || parentBoxFlow === "inline-column") {
      return { flexGrow: 1, flexBasis: "0%" }; // Grow horizontally in row
    }
    if (parentBoxFlow === "row") {
      return { minWidth: "100%", width: "auto" }; // Take full width in column
    }
    return { minWidth: "100%", width: "auto" }; // Take full width outside flex
  },
  expandY: (value, { parentBoxFlow }) => {
    if (!value) {
      return null;
    }
    if (parentBoxFlow === "column") {
      return { minHeight: "100%", height: "auto" }; // Make column full height
    }
    if (parentBoxFlow === "row" || parentBoxFlow === "inline-row") {
      return { flexGrow: 1, flexBasis: "0%" }; // Make row full height
    }
    return { minHeight: "100%", height: "auto" }; // Take full height outside flex
  },
  shrinkX: (value, { parentBoxFlow }) => {
    if (parentBoxFlow === "row" || parentBoxFlow === "inline-row") {
      if (!value || value === "0") {
        return { flexShrink: 0 };
      }
      return { flexShrink: 1 };
    }
    return { maxWidth: "100%" };
  },
  shrinkY: (value, { parentBoxFlow }) => {
    if (parentBoxFlow === "column" || parentBoxFlow === "inline-column") {
      if (!value || value === "0") {
        return { flexShrink: 0 };
      }
      return { flexShrink: 1 };
    }
    return { maxHeight: "100%" };
  },

  scaleX: (value) => {
    return { transform: `scaleX(${stringifyStyle(value, "scaleX")})` };
  },
  scaleY: (value) => {
    return { transform: `scaleY(${value})` };
  },
  scale: (value) => {
    if (Array.isArray(value)) {
      const [x, y] = value;
      return { transform: `scale(${x}, ${y})` };
    }
    return { transform: `scale(${value})` };
  },
  scaleZ: (value) => {
    return { transform: `scaleZ(${value})` };
  },
};
const POSITION_PROPS = {
  // For row, selfAlignX uses auto margins for positioning
  // NOTE: Auto margins only work effectively for positioning individual items.
  // When multiple adjacent items have the same auto margin alignment (e.g., selfAlignX="end"),
  // only the first item will be positioned as expected because subsequent items
  // will be positioned relative to the previous item's margins, not the container edge.
  selfAlignX: (value, { parentBoxFlow }) => {
    const inRowFlow = parentBoxFlow === "row" || parentBoxFlow === "inline-row";

    if (value === "start") {
      if (inRowFlow) {
        return { alignSelf: "start" };
      }
      return { marginRight: "auto" };
    }
    if (value === "end") {
      if (inRowFlow) {
        return { alignSelf: "end" };
      }
      return { marginLeft: "auto" };
    }
    if (value === "center") {
      if (inRowFlow) {
        return { alignSelf: "center" };
      }
      return { marginLeft: "auto", marginRight: "auto" };
    }
    if (inRowFlow && value !== "stretch") {
      return { alignSelf: value };
    }
    return undefined;
  },
  selfAlignY: (value, { parentBoxFlow }) => {
    const inColumnFlow =
      parentBoxFlow === "column" || parentBoxFlow === "inline-column";

    if (value === "start") {
      if (inColumnFlow) {
        return { alignSelf: "start" };
      }
      return { marginBottom: "auto" };
    }
    if (value === "center") {
      if (inColumnFlow) {
        return { alignSelf: "center" };
      }
      return { marginTop: "auto", marginBottom: "auto" };
    }
    if (value === "end") {
      if (inColumnFlow) {
        return { alignSelf: "end" };
      }
      return { marginTop: "auto" };
    }
    return undefined;
  },
  left: PASS_THROUGH,
  top: PASS_THROUGH,
  bottom: PASS_THROUGH,
  right: PASS_THROUGH,

  translateX: (value) => {
    return { transform: `translateX(${value})` };
  },
  translateY: (value) => {
    return { transform: `translateY(${value})` };
  },
  translate: (value) => {
    if (Array.isArray(value)) {
      const [x, y] = value;
      return { transform: `translate(${x}, ${y})` };
    }
    return { transform: `translate(${stringifyStyle(value, "translateX")})` };
  },
  rotateX: (value) => {
    return { transform: `rotateX(${value})` };
  },
  rotateY: (value) => {
    return { transform: `rotateY(${value})` };
  },
  rotateZ: (value) => {
    return { transform: `rotateZ(${value})` };
  },
  rotate: (value) => {
    return { transform: `rotate(${value})` };
  },
  skewX: (value) => {
    return { transform: `skewX(${value})` };
  },
  skewY: (value) => {
    return { transform: `skewY(${value})` };
  },
  skew: (value) => {
    if (Array.isArray(value)) {
      const [x, y] = value;
      return { transform: `skew(${x}, ${y})` };
    }
    return { transform: `skew(${value})` };
  },
};
const TYPO_PROPS = {
  font: applyOnCSSProp("fontFamily"),
  fontFamily: PASS_THROUGH,
  fontWeight: PASS_THROUGH,
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
  preLine: applyToCssPropWhenTruthy("whiteSpace", "pre-line", "normal"),
};
const VISUAL_PROPS = {
  outline: PASS_THROUGH,
  outlineStyle: PASS_THROUGH,
  outlineColor: PASS_THROUGH,
  outlineWidth: PASS_THROUGH,
  boxDecorationBreak: PASS_THROUGH,
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
  transition: PASS_THROUGH,
  overflow: PASS_THROUGH,
  overflowX: PASS_THROUGH,
  overflowY: PASS_THROUGH,
};
const CONTENT_PROPS = {
  align: applyOnTwoProps("alignX", "alignY"),
  alignX: (value, { boxFlow }) => {
    if (boxFlow === "row" || boxFlow === "inline-row") {
      if (value === "stretch") {
        return undefined; // this is the default
      }
      return { alignItems: value };
    }
    if (boxFlow === "column" || boxFlow === "inline-column") {
      if (value === "start") {
        return undefined; // this is the default
      }
      return { justifyContent: value };
    }
    return { textAlign: value };
  },
  alignY: (value, { boxFlow }) => {
    if (boxFlow === "row" || boxFlow === "inline-row") {
      if (value === "start") {
        return undefined;
      }
      return {
        justifyContent: value,
      };
    }
    if (boxFlow === "column" || boxFlow === "inline-column") {
      if (value === "stretch") {
        return undefined;
      }
      return { alignItems: value };
    }
    return { verticalAlign: value };
  },
  spacing: (value, { boxFlow }) => {
    if (
      boxFlow === "row" ||
      boxFlow === "column" ||
      boxFlow === "inline-row" ||
      boxFlow === "inline-column"
    ) {
      return {
        gap: resolveSpacingSize(value, "gap"),
      };
    }
    return undefined;
  },
};
const All_PROPS = {
  ...FLOW_PROPS,
  ...OUTER_SPACING_PROPS,
  ...INNER_SPACING_PROPS,
  ...DIMENSION_PROPS,
  ...POSITION_PROPS,
  ...TYPO_PROPS,
  ...VISUAL_PROPS,
  ...CONTENT_PROPS,
};
const FLOW_PROP_NAME_SET = new Set(Object.keys(FLOW_PROPS));
const OUTER_SPACING_PROP_NAME_SET = new Set(Object.keys(OUTER_SPACING_PROPS));
const INNER_SPACING_PROP_NAME_SET = new Set(Object.keys(INNER_SPACING_PROPS));
const DIMENSION_PROP_NAME_SET = new Set(Object.keys(DIMENSION_PROPS));
const POSITION_PROP_NAME_SET = new Set(Object.keys(POSITION_PROPS));
const TYPO_PROP_NAME_SET = new Set(Object.keys(TYPO_PROPS));
const VISUAL_PROP_NAME_SET = new Set(Object.keys(VISUAL_PROPS));
const CONTENT_PROP_NAME_SET = new Set(Object.keys(CONTENT_PROPS));
const STYLE_PROP_NAME_SET = new Set(Object.keys(All_PROPS));

const COPIED_ON_VISUAL_CHILD_PROP_SET = new Set([
  ...FLOW_PROP_NAME_SET,
  "expand",
  "shrink",
  "expandX",
  "expandY",
  "alignX",
  "alignY",
]);
const HANDLED_BY_VISUAL_CHILD_PROP_SET = new Set([
  ...INNER_SPACING_PROP_NAME_SET,
  ...VISUAL_PROP_NAME_SET,
  ...CONTENT_PROP_NAME_SET,
]);
export const getVisualChildStylePropStrategy = (name) => {
  if (COPIED_ON_VISUAL_CHILD_PROP_SET.has(name)) {
    return "copy";
  }
  if (HANDLED_BY_VISUAL_CHILD_PROP_SET.has(name)) {
    return "forward";
  }
  return null;
};

export const isStyleProp = (name) => STYLE_PROP_NAME_SET.has(name);

const getStylePropGroup = (name) => {
  if (FLOW_PROP_NAME_SET.has(name)) {
    return "flow";
  }
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
  if (key === "borderRadius") {
    return normalizeSpacingStyle;
  }
  const group = getStylePropGroup(key);
  if (group === "margin" || group === "padding") {
    return normalizeSpacingStyle;
  }
  if (group === "typo") {
    return normalizeTypoStyle;
  }
  return normalizeRegularStyle;
};
const normalizeRegularStyle = (
  value,
  name,
  // styleContext, context
) => {
  return stringifyStyle(value, name);
};
export const getHowToHandleStyleProp = (name) => {
  const getStyle = All_PROPS[name];
  if (getStyle === PASS_THROUGH) {
    return null;
  }
  return getStyle;
};
export const prepareStyleValue = (
  existingValue,
  value,
  name,
  styleContext,
  context,
) => {
  const normalizer = getNormalizer(name);
  const cssValue = normalizer(value, name, styleContext, context);
  const mergedValue = mergeOneStyle(existingValue, cssValue, name, context);
  return mergedValue;
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
sizeSpacingScale.s = sizeSpacingScale.sm;
sizeSpacingScale.m = sizeSpacingScale.md;
sizeSpacingScale.l = sizeSpacingScale.lg;
const sizeSpacingScaleKeys = new Set(Object.keys(sizeSpacingScale));
export const isSizeSpacingScaleKey = (key) => {
  return sizeSpacingScaleKeys.has(key);
};
export const resolveSpacingSize = (size, property = "padding") => {
  return stringifyStyle(sizeSpacingScale[size] || size, property);
};

const sizeTypoScale = {
  xxs: "0.625rem", // 0.625 = 10px at 16px base (smaller than before for more range)
  xs: "0.75rem", // 0.75 = 12px at 16px base
  sm: "0.875rem", // 0.875 = 14px at 16px base
  md: "1rem", // 1 = 16px at 16px base (base font size)
  lg: "1.125rem", // 1.125 = 18px at 16px base
  xl: "1.25rem", // 1.25 = 20px at 16px base
  xxl: "1.5rem", // 1.5 = 24px at 16px base
};
sizeTypoScale.s = sizeTypoScale.sm;
sizeTypoScale.m = sizeTypoScale.md;
sizeTypoScale.l = sizeTypoScale.lg;
export const resolveTypoSize = (size, property = "fontSize") => {
  return stringifyStyle(sizeTypoScale[size] || size, property);
};
