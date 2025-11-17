import { cssColorKeywordSet } from "./css_color.js";
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
  let expectingSize = false; // Track if we're after a "/" and expecting size
  let colorFound = false; // Track if we've already found a color

  while (i < tokens.length) {
    const token = tokens[i];

    // Skip spaces
    if (token === " ") {
      i++;
      continue;
    }

    // Skip "/" separator
    if (token === "/") {
      expectingSize = true;
      i++;
      continue;
    }

    // If we're expecting size after "/", parse size values
    if (expectingSize) {
      if (isNumericValue(token) || isSizeKeyword(token)) {
        // Collect all size tokens starting with current token
        const sizeTokens = [token]; // Start with current token
        i++; // Move to next token

        while (i < tokens.length && tokens[i] !== "/") {
          const currentToken = tokens[i];
          // Skip spaces
          if (currentToken === " ") {
            i++;
            continue;
          }
          // Check if it's a size/numeric value
          if (isNumericValue(currentToken) || isSizeKeyword(currentToken)) {
            sizeTokens.push(currentToken);
            i++;
          } else {
            // Hit a non-size value, stop collecting
            break;
          }
        }

        backgroundObj.size = sizeTokens.join(" ");
        expectingSize = false;
        continue; // Don't increment i since we're already positioned correctly
      } else {
        expectingSize = false; // Invalid size, continue with normal parsing
      }
    }

    // Check for colors early (can appear at the beginning or end)
    if (!colorFound && isSimpleColor(token)) {
      const normalizedColor = parseStyle(token, "backgroundColor", element);
      backgroundObj.color = normalizedColor;
      colorFound = true;
    }
    // Check for image functions (gradients, url) - can appear early
    else if (isImageFunction(token)) {
      const parsedImage = parseCSSImage(token, element);
      backgroundObj.image = parsedImage;
    }
    // Check for position values (appear before size, after image)
    else if (
      isPositionValue(token) ||
      (isNumericValue(token) && !expectingSize)
    ) {
      // Collect position tokens until we hit a "/" or non-position value
      const positionTokens = [token]; // Start with current token
      i++; // Move to next token

      while (i < tokens.length && tokens[i] !== "/") {
        const currentToken = tokens[i];
        // Skip spaces
        if (currentToken === " ") {
          i++;
          continue;
        }
        // Check if it's a position/numeric value
        if (isPositionValue(currentToken) || isNumericValue(currentToken)) {
          positionTokens.push(currentToken);
          i++;
        } else {
          // Hit a non-position value, stop collecting
          break;
        }
      }

      backgroundObj.position = positionTokens.join(" ");
      continue; // Don't increment i since we're already positioned correctly
    }
    // Check for repeat values (after position/size)
    else if (isRepeatValue(token)) {
      backgroundObj.repeat = token;
    }
    // Check for attachment values (after repeat)
    else if (isAttachmentValue(token)) {
      backgroundObj.attachment = token;
    }
    // Check for box values (origin/clip - near the end)
    else if (isBoxValue(token)) {
      // In CSS, origin comes before clip, but they can appear in either order
      if (backgroundObj.origin === undefined) {
        backgroundObj.origin = token;
      } else if (backgroundObj.clip === undefined) {
        backgroundObj.clip = token;
      }
      // If both are set, this might be a duplicate or error, but we'll take the last one
      else {
        backgroundObj.clip = token;
      }
    }

    i++;
  }

  return backgroundObj;
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

  // CSS color keywords using the imported Set
  if (cssColorKeywordSet.has(trimmed.toLowerCase())) {
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
