import {
  appendStyles,
  createStyleController,
  normalizeStyle,
  normalizeStyles,
} from "@jsenv/dom";
import { useContext } from "preact/hooks";

import { BoxLayoutContext } from "../layout/layout_context.jsx";

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

const naviStyleController = createStyleController("navi");
const pseudoStyleControllers = {
  ":hover": createStyleController("navi:hover"),
  ":active": createStyleController("navi:active"),
  ":checked": createStyleController("navi:checked"),
  ":disabled": createStyleController("navi:disabled"),
  ":focus": createStyleController("navi:focus"),
  ":focus-visible": createStyleController("navi:focus-visible"),
  ":valid": createStyleController("navi:valid"),
  ":invalid": createStyleController("navi:invalid"),
  ":read-only": createStyleController("navi:read-only"),
  ":visited": createStyleController("navi:visited"),
  "::-navi-loader": createStyleController("navi::-navi-loader"),
};

export const applyStyles = (element, style, pseudoStyles, pseudoStates) => {
  naviStyleController.set(element, style);
  if (pseudoStyles) {
    for (const pseudoName of Object.keys(pseudoStyles)) {
      const stylesToApply = pseudoStyles[pseudoName];
      const pseudoStyleController = pseudoStyleControllers[pseudoName];
      if (pseudoName.startsWith("::")) {
        pseudoStyleController.set(element, stylesToApply);
        continue;
      }
      const shouldApply = pseudoStates[pseudoName];
      if (shouldApply) {
        pseudoStyleController.set(element, stylesToApply);
      } else {
        pseudoStyleController.clear(element);
      }
    }
  }
};

const normalizeSpacingStyle = (value, property = "padding") => {
  const cssSize = sizeSpacingScale[value];
  return cssSize || normalizeStyle(value, property, "css");
};
const normalizeTypoStyle = (value, property = "fontSize") => {
  const cssSize = sizeTypoScale[value];
  return cssSize || normalizeStyle(value, property, "css");
};
const PASS_THROUGH = {};
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
const SIZE_PROPS = {
  width: PASS_THROUGH,
  minWidth: PASS_THROUGH,
  maxWidth: PASS_THROUGH,
  height: PASS_THROUGH,
  minHeight: PASS_THROUGH,
  maxHeight: PASS_THROUGH,
  // apply after width/height to override if both are set
  expandX: (value, { boxLayout }) => {
    if (!value) {
      return null;
    }
    if (boxLayout === "column") {
      return { flexGrow: 1 }; // Grow horizontally in row
    }
    if (boxLayout === "row") {
      return { width: "100%" }; // Take full width in column
    }
    return { width: "100%" }; // Take full width outside flex
  },
  expandY: (value, { boxLayout }) => {
    if (!value) {
      return null;
    }
    if (boxLayout === "column") {
      return { height: "100%" }; // Make column full height
    }
    if (boxLayout === "row") {
      return { flexGrow: 1 }; // Make row full height
    }
    return { height: "100%" }; // Take full height outside flex
  },
};
const ALIGNEMENT_PROPS = {
  // For row, alignX uses auto margins for positioning
  // NOTE: Auto margins only work effectively for positioning individual items.
  // When multiple adjacent items have the same auto margin alignment (e.g., alignX="end"),
  // only the first item will be positioned as expected because subsequent items
  // will be positioned relative to the previous item's margins, not the container edge.
  alignX: (value, { boxLayout }) => {
    if (value === "start") {
      if (boxLayout === "row") {
        return { alignSelf: "start" };
      }
      return { marginRight: "auto" };
    }
    if (value === "end") {
      if (boxLayout === "row") {
        return { alignSelf: "end" };
      }
      return { marginLeft: "auto" };
    }
    if (value === "center") {
      if (boxLayout === "row") {
        return { alignSelf: "center" };
      }
      return { marginLeft: "auto", marginRight: "auto" };
    }
    if (boxLayout === "row" && value !== "stretch") {
      return { alignSelf: value };
    }
    return undefined;
  },
  alignY: (value, { boxLayout }) => {
    if (value === "start") {
      if (boxLayout === "column") {
        return undefined; // this is the default
      }
      if (boxLayout === "inline") {
        return undefined; // this is the default
      }
      return { marginBottom: "auto" };
    }
    if (value === "center") {
      if (boxLayout === "column") {
        return { alignSelf: "center" };
      }
      if (boxLayout === "inline") {
        return { alignSelf: "center" };
      }
      return { marginTop: "auto", marginBottom: "auto" };
    }
    if (value === "end") {
      if (boxLayout === "inline") {
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
  textSize: applyOnCSSProp("fontSize"),
  textBold: applyToCssPropWhenTruthy("fontWeight", "bold", "normal"),
  textThin: applyToCssPropWhenTruthy("fontWeight", "thin", "normal"),
  textItalic: applyToCssPropWhenTruthy("fontStyle", "italic", "normal"),
  textUnderline: applyToCssPropWhenTruthy(
    "textDecoration",
    "underline",
    "none",
  ),
  textUnderlineStyle: applyOnCSSProp("textDecorationStyle"),
  textUnderlineColor: applyOnCSSProp("textDecorationColor"),
  textShadow: PASS_THROUGH,
  textLineHeight: applyOnCSSProp("lineHeight"),
  textColor: applyOnCSSProp("color"),
  noWrap: applyToCssPropWhenTruthy("whiteSpace", "nowrap", "normal"),
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
const All_PROPS = {
  ...OUTER_SPACING_PROPS,
  ...INNER_SPACING_PROPS,
  ...SIZE_PROPS,
  ...ALIGNEMENT_PROPS,
  ...TYPO_PROPS,
  ...VISUAL_PROPS,
};

const generateStyleGroup = (
  PROPS_GROUP,
  props,
  styleContext,
  normalizer = normalizeStyle,
) => {
  const styleGroup = {};
  for (const propName of Object.keys(PROPS_GROUP)) {
    assignStyle(
      styleGroup,
      props[propName],
      propName,
      styleContext,
      normalizer,
    );
  }
  return styleGroup;
};
const generateStyleWithoutGroup = (
  props,
  styleContext,
  normalizer = normalizeStyle,
) => {
  const styleWithoutGroup = {};
  for (const propName of Object.keys(props)) {
    assignStyle(
      styleWithoutGroup,
      props[propName],
      propName,
      styleContext,
      normalizer,
    );
  }
  return styleWithoutGroup;
};
const assignStyle = (
  styleObject,
  propValue,
  propName,
  styleContext,
  normalizer,
) => {
  if (propValue === undefined) {
    return;
  }
  const { managedByCSSVars } = styleContext;
  const getStyle = All_PROPS[propName];
  if (getStyle === PASS_THROUGH) {
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
    const cssValue = normalizer(values[key], key);
    const cssVar = managedByCSSVars[key];
    if (cssVar) {
      styleObject[cssVar] = cssValue;
    } else {
      styleObject[key] = cssValue;
    }
  }
};

export const withPropsStyle = (
  props,
  {
    base,
    layout,
    spacing = layout,
    outerSpacing = spacing,
    innerSpacing = spacing,
    align = layout,
    size = layout,
    typo,
    visual = true,

    pseudoClasses,
    pseudoElements,
    managedByCSSVars = {},
  },
  ...remainingConfig
) => {
  const boxLayout = useContext(BoxLayoutContext);
  /* eslint-disable no-unused-vars */
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
    left,
    top,
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
    noWrap,

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
    cursor,

    // pseudo class props
    pseudo,

    // props not related to styling
    ...remainingProps
  } = props;
  /* eslint-enable no-unused-vars */

  const hasRemainingConfig = remainingConfig.length > 0;
  let propStyles;
  let marginStyles;
  let paddingStyles;
  let alignmentStyles;
  let sizeStyles;
  let typoStyles;
  let visualStyles;
  let pseudoNamedStyles = {};

  const styleContext = {
    boxLayout,
    managedByCSSVars,
  };

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
    marginStyles = generateStyleGroup(
      OUTER_SPACING_PROPS,
      props,
      styleContext,
      normalizeSpacingStyle,
    );
    paddingStyles = generateStyleGroup(
      INNER_SPACING_PROPS,
      props,
      styleContext,
      normalizeSpacingStyle,
    );
  }
  size_styles: {
    if (!size && !hasRemainingConfig) {
      break size_styles;
    }
    sizeStyles = generateStyleGroup(SIZE_PROPS, props, styleContext);
  }
  alignment_styles: {
    if (!align && !hasRemainingConfig) {
      break alignment_styles;
    }
    alignmentStyles = generateStyleGroup(ALIGNEMENT_PROPS, props, styleContext);
  }
  typo_styles: {
    if (!typo && !hasRemainingConfig) {
      break typo_styles;
    }
    typoStyles = generateStyleGroup(
      TYPO_PROPS,
      props,
      styleContext,
      normalizeTypoStyle,
    );
  }
  visual_styles: {
    if (!visual && !hasRemainingConfig) {
      break visual_styles;
    }
    visualStyles = generateStyleGroup(VISUAL_PROPS, props, styleContext);
  }
  pseudo_styles: {
    if (!pseudo) {
      break pseudo_styles;
    }
    pseudo_classes: {
      if (!pseudoClasses) {
        break pseudo_classes;
      }
      for (const pseudoClass of pseudoClasses) {
        const pseudoClassStyleFromProps = pseudo[pseudoClass];
        if (!pseudoClassStyleFromProps) {
          continue;
        }
        const pseudoClassStyles = generateStyleWithoutGroup(
          pseudoClassStyleFromProps,
          styleContext,
        );
        pseudoNamedStyles[pseudoClass] = pseudoClassStyles;
      }
    }
    pseudo_elements: {
      if (!pseudoElements) {
        break pseudo_elements;
      }
      for (const pseudoElement of pseudoElements) {
        const pseudoElementStyleFromProps = pseudo[pseudoElement];
        if (!pseudoElementStyleFromProps) {
          continue;
        }
        const pseudoElementStyles = generateStyleWithoutGroup(
          pseudoElementStyleFromProps,
          styleContext,
        );
        pseudoNamedStyles[pseudoElement] = pseudoElementStyles;
      }
    }
  }

  const firstConfigStyle = {};
  if (base) {
    Object.assign(firstConfigStyle, base);
  }
  if (outerSpacing) {
    Object.assign(firstConfigStyle, marginStyles);
  }
  if (innerSpacing) {
    Object.assign(firstConfigStyle, paddingStyles);
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
    if (config.outerSpacing || config.spacing || config.layout) {
      Object.assign(configStyle, marginStyles);
    }
    if (config.innerSpacing || config.spacing || config.layout) {
      Object.assign(configStyle, paddingStyles);
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
  result.push(pseudoNamedStyles);
  return result;
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
