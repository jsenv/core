import { parseCSSImage, stringifyCSSImage } from "./css_image.js";
import { splitCSSLayers, tokenizeCSS } from "./css_tokenizer.js";

// Convert background object to CSS string
export const stringifyCSSBackground = (backgroundObj, normalize) => {
  const parts = [];

  // Order matters for CSS background shorthand
  // background: [background-color] [background-image] [background-repeat]
  //            [background-attachment] [background-position] / [background-size]
  //            [background-clip] [background-origin]

  if (backgroundObj.image !== undefined) {
    const normalizedImage =
      typeof backgroundObj.image === "object" && backgroundObj.image !== null
        ? stringifyCSSImage(backgroundObj.image)
        : normalize(backgroundObj.image, "backgroundImage", "css");
    parts.push(normalizedImage);
  }

  if (backgroundObj.repeat !== undefined) {
    parts.push(backgroundObj.repeat);
  }

  if (backgroundObj.attachment !== undefined) {
    parts.push(backgroundObj.attachment);
  }

  if (backgroundObj.position !== undefined) {
    parts.push(backgroundObj.position);
  }

  if (backgroundObj.size !== undefined) {
    // background-size must be preceded by "/"
    parts.push(`/ ${backgroundObj.size}`);
  }

  if (backgroundObj.clip !== undefined) {
    parts.push(backgroundObj.clip);
  }

  if (backgroundObj.origin !== undefined) {
    parts.push(backgroundObj.origin);
  }

  if (backgroundObj.color !== undefined) {
    const normalizedColor = normalize(
      backgroundObj.color,
      "backgroundColor",
      "css",
    );
    parts.push(normalizedColor);
  }

  return parts.join(" ");
};

// Parse background CSS string into object
export const parseCSSBackground = (
  backgroundString,
  { parseStyle, element },
) => {
  if (!backgroundString || backgroundString === "none") {
    return {};
  }
  if (backgroundString === "transparent") {
    return {
      color: parseStyle("transparent", "backgroundColor", element),
    };
  }

  // Handle simple cases first
  if (isSimpleColor(backgroundString)) {
    const normalizedColor = parseStyle(
      backgroundString,
      "backgroundColor",
      element,
    );
    return { color: normalizedColor };
  }

  // Handle image functions (gradients, url(), etc.)
  if (isImageFunction(backgroundString)) {
    const parsedImage = parseCSSImage(backgroundString, element);
    return { image: parsedImage };
  }

  // Complex background parsing - split by commas for multiple backgrounds
  const layers = splitCSSLayers(backgroundString);

  if (layers.length === 1) {
    return parseBackgroundLayer(layers[0], { parseStyle, element });
  }

  // Multiple background layers - return array
  return layers.map((layer) =>
    parseBackgroundLayer(layer, { parseStyle, element }),
  );
};

// Parse a single background layer
const parseBackgroundLayer = (layerString, { parseStyle, element }) => {
  const backgroundObj = {};
  const tokens = tokenizeCSS(layerString, {
    separators: [" ", "/"],
    preserveSeparators: true,
  });

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    // Check for image functions (gradients, url)
    if (isImageFunction(token)) {
      const parsedImage = parseCSSImage(token, element);
      backgroundObj.image = parsedImage;
    }
    // Check for colors
    else if (isSimpleColor(token)) {
      const normalizedColor = parseStyle(token, "backgroundColor", element);
      backgroundObj.color = normalizedColor;
    }
    // Check for repeat values
    else if (isRepeatValue(token)) {
      backgroundObj.repeat = token;
    }
    // Check for attachment values
    else if (isAttachmentValue(token)) {
      backgroundObj.attachment = token;
    }
    // Check for position/size values
    else if (isPositionValue(token) || isNumericValue(token)) {
      // Handle position and size parsing
      const positionSize = parsePositionAndSize(tokens, i);
      if (positionSize.position !== undefined) {
        backgroundObj.position = positionSize.position;
      }
      if (positionSize.size !== undefined) {
        backgroundObj.size = positionSize.size;
      }
      i = positionSize.nextIndex - 1; // -1 because loop will increment
    }
    // Check for box values (clip/origin)
    else if (isBoxValue(token)) {
      // First box value is clip, second is origin
      if (backgroundObj.clip === undefined) {
        backgroundObj.clip = token;
      } else {
        backgroundObj.origin = token;
      }
    }

    i++;
  }

  return backgroundObj;
};

// Parse position and size values (position / size format)
const parsePositionAndSize = (tokens, startIndex) => {
  const result = { nextIndex: startIndex + 1 };
  const positionTokens = [];
  let i = startIndex;

  // Collect position tokens until we hit a "/" or non-position value
  while (i < tokens.length && tokens[i] !== "/") {
    if (isPositionValue(tokens[i]) || isNumericValue(tokens[i])) {
      positionTokens.push(tokens[i]);
      i++;
    } else {
      break;
    }
  }

  if (positionTokens.length > 0) {
    result.position = positionTokens.join(" ");
  }

  // Check for size after "/"
  if (i < tokens.length && tokens[i] === "/") {
    i++; // Skip "/"
    const sizeTokens = [];
    while (
      i < tokens.length &&
      (isNumericValue(tokens[i]) || isSizeKeyword(tokens[i]))
    ) {
      sizeTokens.push(tokens[i]);
      i++;
    }
    if (sizeTokens.length > 0) {
      result.size = sizeTokens.join(" ");
    }
  }

  result.nextIndex = i;
  return result;
};

// Helper functions to identify token types
const isImageFunction = (value) => {
  return /^(?:url|linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|repeating-conic-gradient|image|element|cross-fade)\s*\(/.test(
    value,
  );
};

const isSimpleColor = (value) => {
  if (!value || typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  // Only match if it's a single word/token without spaces (except within parentheses)
  // This prevents matching colors within complex background strings
  if (trimmed.includes(" ")) {
    // Allow spaces only within function calls like rgb(255, 0, 0)
    const functionMatch = /^[a-z]+\s*\([^)]*\)$/i.test(trimmed);
    if (!functionMatch) {
      return false;
    }
  }

  // Hex colors: #rgb, #rrggbb, #rrggbbaa
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) {
    return true;
  }

  // RGB/RGBA functions
  if (/^rgba?\s*\([^)]*\)$/i.test(trimmed)) {
    return true;
  }

  // HSL/HSLA functions
  if (/^hsla?\s*\([^)]*\)$/i.test(trimmed)) {
    return true;
  }

  // CSS color keywords (basic check for word boundaries)
  if (/^[a-z]+$/i.test(trimmed)) {
    // Additional validation could be added here for known CSS color names
    return true;
  }

  return false;
};

const isRepeatValue = (value) => {
  return [
    "repeat",
    "repeat-x",
    "repeat-y",
    "no-repeat",
    "space",
    "round",
  ].includes(value);
};

const isAttachmentValue = (value) => {
  return ["scroll", "fixed", "local"].includes(value);
};

const isPositionValue = (value) => {
  return ["left", "center", "right", "top", "bottom"].includes(value);
};

const isNumericValue = (value) => {
  return /^-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|ch|ex|cm|mm|in|pt|pc)?$/.test(
    value,
  );
};

const isSizeKeyword = (value) => {
  return ["auto", "contain", "cover"].includes(value);
};

const isBoxValue = (value) => {
  return ["border-box", "padding-box", "content-box", "text"].includes(value);
};
