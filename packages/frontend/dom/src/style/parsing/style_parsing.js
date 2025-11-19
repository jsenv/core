import {
  parseCSSBackground,
  stringifyCSSBackground,
} from "./css_background.js";
import { parseCSSBorder, stringifyCSSBorder } from "./css_border.js";
import { parseCSSColor, stringifyCSSColor } from "./css_color.js";
import { parseCSSImage, stringifyCSSImage } from "./css_image.js";
import { parseCSSTransform, stringifyCSSTransform } from "./css_transform.js";
import {
  parseCSSWillChange,
  stringifyCSSWillChange,
} from "./css_will_change.js";

// Properties that can use px units
const pxPropertySet = new Set([
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "top",
  "left",
  "right",
  "bottom",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontSize",
  // lineHeight intentionally excluded - it should remain unitless when no unit is specified
  "letterSpacing",
  "wordSpacing",
  "translateX",
  "translateY",
  "translateZ",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "gap",
  "rowGap",
  "columnGap",
]);

// Properties that need deg units
const degPropertySet = new Set([
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skew",
  "skewX",
  "skewY",
]);

// Properties that should remain unitless
const unitlessPropertySet = new Set([
  "opacity",
  "zIndex",
  "flexGrow",
  "flexShrink",
  "order",
  "columnCount",
  "scale",
  "scaleX",
  "scaleY",
  "scaleZ",
]);

// Well-known CSS units and keywords that indicate a value already has proper formatting
const cssSizeUnitSet = new Set([
  "px",
  "em",
  "rem",
  "ex",
  "ch",
  "vw",
  "vh",
  "dvw",
  "dvh",
  "svw",
  "svh",
  "lvw",
  "lvh",
  "vmin",
  "vmax",
  "cm",
  "mm",
  "in",
  "pt",
  "pc",
]);
const cssUnitSet = new Set([
  ...cssSizeUnitSet,
  "%",
  // Angle units
  "deg",
  "rad",
  "grad",
  "turn",
  // Time units
  "s",
  "ms",
  // Frequency units
  "Hz",
  "kHz",
]);
// Global CSS keywords that apply to any property
const globalCSSKeywordSet = new Set([
  "auto",
  "none",
  "inherit",
  "initial",
  "unset",
  "revert",
]);
// Keywords that should NOT get automatic units when used with properties from:
// - pxPropertySet (width, height, fontSize, etc.)
// - degPropertySet (rotate, skew, etc.)
// - unitlessPropertySet (opacity, zIndex, etc.)
// This prevents auto-unit addition: e.g., width: "auto" stays "auto", not "autopx"
const unitlessKeywordSet = new Set([
  ...globalCSSKeywordSet,
  // Size/dimension keywords for pxPropertySet properties
  "fit-content",
  "min-content",
  "max-content",
  // Font size keywords for fontSize
  "medium",
  "small",
  "large",
  "x-small",
  "x-large",
  "xx-small",
  "xx-large",
  "smaller",
  "larger",
  // Border width keywords for borderWidth properties
  "thin",
  "thick",
  // Line height keyword (though lineHeight is handled specially)
  "normal",
]);
// Keywords for backgroundImage property that should NOT be wrapped in url()
// Used to prevent: background: "none" becoming background: "url(none)"
const backgroundKeywordSet = new Set([
  ...globalCSSKeywordSet,
  // Background-specific keywords
  "transparent",
  "currentColor",
]);

const colorPropertySet = new Set([
  "outlineColor",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "backgroundColor",
  "color",
  "textDecorationColor",
  "textEmphasisColor",
  "caretColor",
  "columnRuleColor",
  "accentColor",
  "scrollbarColor",
  "stroke",
  "fill",
]);

const getUnit = (value) => {
  for (const cssUnit of cssUnitSet) {
    if (value.endsWith(cssUnit)) {
      return cssUnit;
    }
  }
  return "";
};
// Check if value already has a unit
const isUnitless = (value) => getUnit(value) === "";

// url(
// linear-gradient(
// radial-gradient(
// ...
const STARTS_WITH_CSS_IMAGE_FUNCTION_REGEX = /^[a-z-]+\(/;
// Normalize a single style value
export const normalizeStyle = (
  value,
  propertyName,
  context = "js",
  element,
) => {
  if (propertyName === "transform") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer objects
        return parseCSSTransform(value, normalizeStyle);
      }
      // If code does transform: { translateX: "10px" }
      // we want to store { translateX: 10 }
      const transformNormalized = {};
      for (const key of Object.keys(value)) {
        const partValue = normalizeStyle(value[key], key, context, element);
        transformNormalized[key] = partValue;
      }
      return transformNormalized;
    }
    if (typeof value === "object" && value !== null) {
      // For CSS context, ensure transform is a string
      return stringifyCSSTransform(value, normalizeStyle);
    }
    return value;
  }

  if (propertyName === "willChange") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer arrays
        return parseCSSWillChange(value);
      }
      return value;
    }
    if (Array.isArray(value)) {
      // For CSS context, ensure willChange is a string
      return stringifyCSSWillChange(value);
    }
    return value;
  }

  if (propertyName === "background") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer objects
        return parseCSSBackground(value, {
          parseStyle,
          element,
        });
      }
      // If code does background: { color: "red", image: "url(...)" }
      // we want to normalize each part
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const backgroundNormalized = {};
        for (const key of Object.keys(value)) {
          const partValue = normalizeStyle(
            value[key],
            `background${key.charAt(0).toUpperCase() + key.slice(1)}`,
            context,
            element,
          );
          backgroundNormalized[key] = partValue;
        }
        return backgroundNormalized;
      }
      return value;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // For CSS context, ensure background is a string
      return stringifyCSSBackground(value, normalizeStyle);
    }
    return value;
  }

  if (propertyName === "border") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer objects
        return parseCSSBorder(value, element);
      }
      // If code does border: { width: 2, style: "solid", color: "red" }
      // we want to normalize each part
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const borderNormalized = {};
        for (const key of Object.keys(value)) {
          const partValue = normalizeStyle(
            value[key],
            `border${key.charAt(0).toUpperCase() + key.slice(1)}`,
            context,
            element,
          );
          borderNormalized[key] = partValue;
        }
        return borderNormalized;
      }
      return value;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // For CSS context, ensure border is a string
      return stringifyCSSBorder(value);
    }
    return value;
  }

  // Handle transform.* properties (e.g., "transform.translateX")
  if (propertyName.startsWith("transform.")) {
    if (context === "css") {
      console.warn(
        `normalizeStyle: magic properties like "${propertyName}" are not applicable in "css" context. Returning original value.`,
      );
      return value;
    }
    const transformProperty = propertyName.slice(10); // Remove "transform." prefix
    // If value is a CSS transform string, parse it first to extract the specific property
    if (typeof value === "string") {
      if (value === "none") {
        if (transformProperty.startsWith("scale")) {
          return 1;
        }
        // translate, rotate, skew
        return 0;
      }
      const parsedTransform = parseCSSTransform(value, normalizeStyle);
      return parsedTransform?.[transformProperty];
    }
    // If value is a transform object, extract the property directly
    if (typeof value === "object" && value !== null) {
      return value[transformProperty];
    }
    // never supposed to happen, the value given is neither string nor object
    return undefined;
  }

  if (propertyName === "backgroundImage") {
    if (context === "js") {
      if (typeof value === "string") {
        // For js context, prefer structured objects
        return parseCSSImage(value, element);
      }
      return value;
    }
    if (typeof value === "object" && value !== null) {
      // For CSS context, ensure backgroundImage is a string
      return stringifyCSSImage(value);
    }
    // Fallback: add url() wrapper if needed
    if (
      typeof value === "string" &&
      !backgroundKeywordSet.has(value) &&
      !STARTS_WITH_CSS_IMAGE_FUNCTION_REGEX.test(value)
    ) {
      return `url(${value})`;
    }
    return value;
  }

  if (propertyName === "lineHeight") {
    if (context === "js") {
      if (typeof value === "string") {
        const unit = getUnit(value);
        if (unit === "px") {
          const float = parseFloat(value);
          return float;
        }
        if (unit === "") {
          return `${value}em`;
        }
        return value;
      }
    }
    if (context === "css") {
      if (typeof value === "number") {
        // When line height is converted to a number it means
        // it was in pixels, we must restore the unit
        return `${value}px`;
      }
    }
    return value;
  }

  if (pxPropertySet.has(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "px",
      preferedType: context === "js" ? "number" : "string",
    });
  }
  if (degPropertySet.has(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "deg",
      preferedType: "string",
    });
  }
  if (unitlessPropertySet.has(propertyName)) {
    return normalizeNumber(value, {
      propertyName,
      unit: "",
      preferedType: context === "js" ? "number" : "string",
    });
  }

  if (colorPropertySet.has(propertyName)) {
    const rgba = parseCSSColor(value, element);
    if (context === "js") {
      return rgba;
    }
    return stringifyCSSColor(rgba);
  }

  return value;
};
export const parseStyle = (value, propertyName, element) => {
  return normalizeStyle(value, propertyName, "js", element);
};
export const stringifyStyle = (value, propertyName, element) => {
  return normalizeStyle(value, propertyName, "css", element);
};

const normalizeNumber = (value, { unit, propertyName, preferedType }) => {
  if (typeof value === "string") {
    // Keep strings as-is (including %, em, rem, auto, none, etc.)
    if (preferedType === "string") {
      if (unit && isUnitless(value) && !unitlessKeywordSet.has(value)) {
        return `${value}${unit}`;
      }
      return value;
    }
    // convert to number if possible (font-size: "12px" -> fontSize:12, opacity: "0.5" -> opacity: 0.5)
    if (!unit || value.endsWith(unit)) {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        return numericValue;
      }
    }
    return value;
  }
  if (typeof value === "number") {
    if (isNaN(value)) {
      console.warn(`NaN found for "${propertyName}"`);
    }
    if (preferedType === "number") {
      return value;
    }
    // convert to string with unit
    return `${value}${unit}`;
  }

  return value;
};

// Normalize styles for DOM application
export const normalizeStyles = (styles, context = "js", mutate = false) => {
  if (!styles) {
    return mutate ? styles : {};
  }
  if (typeof styles === "string") {
    styles = parseStyleString(styles, context);
    return styles;
  }
  if (mutate) {
    for (const key of Object.keys(styles)) {
      const value = styles[key];
      styles[key] = normalizeStyle(value, key, context);
    }
    return styles;
  }
  const normalized = {};
  for (const key of Object.keys(styles)) {
    const value = styles[key];
    if (value === undefined) {
      continue;
    }
    normalized[key] = normalizeStyle(value, key, context);
  }
  return normalized;
};

/**
 * Parses a CSS style string into a style object.
 * Handles CSS properties with proper camelCase conversion.
 *
 * @param {string} styleString - CSS style string like "color: red; font-size: 14px;"
 * @returns {object} Style object with camelCase properties
 */
export const parseStyleString = (styleString, context = "js") => {
  const style = {};

  if (!styleString || typeof styleString !== "string") {
    return style;
  }

  // Split by semicolon and process each declaration
  const declarations = styleString.split(";");

  for (let declaration of declarations) {
    declaration = declaration.trim();
    if (!declaration) continue;

    const colonIndex = declaration.indexOf(":");
    if (colonIndex === -1) continue;

    const property = declaration.slice(0, colonIndex).trim();
    const value = declaration.slice(colonIndex + 1).trim();

    if (property && value) {
      // CSS custom properties (starting with --) should NOT be converted to camelCase
      if (property.startsWith("--")) {
        style[property] = normalizeStyle(value, property, context);
      } else {
        // Convert kebab-case to camelCase (e.g., "font-size" -> "fontSize")
        const camelCaseProperty = property.replace(
          /-([a-z])/g,
          (match, letter) => letter.toUpperCase(),
        );
        style[camelCaseProperty] = normalizeStyle(
          value,
          camelCaseProperty,
          context,
        );
      }
    }
  }

  return style;
};
