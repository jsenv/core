// Convert background object to CSS string
export const stringifyCSSBackground = (backgroundObj, normalize) => {
  const parts = [];

  // Order matters for CSS background shorthand
  // background: [background-color] [background-image] [background-repeat]
  //            [background-attachment] [background-position] / [background-size]
  //            [background-clip] [background-origin]

  if (backgroundObj.image !== undefined) {
    const normalizedImage = normalize(
      backgroundObj.image,
      "backgroundImage",
      "css",
    );
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
export const parseCSSBackground = (backgroundString, normalize) => {
  if (
    !backgroundString ||
    backgroundString === "none" ||
    backgroundString === "transparent"
  ) {
    return backgroundString === "transparent"
      ? { color: "transparent" }
      : undefined;
  }

  // Handle simple cases first
  if (isSimpleColor(backgroundString)) {
    const normalizedColor = normalize(
      backgroundString,
      "backgroundColor",
      "js",
    );
    return { color: normalizedColor };
  }

  // Handle image functions (gradients, url(), etc.)
  if (isImageFunction(backgroundString)) {
    const normalizedImage = normalize(
      backgroundString,
      "backgroundImage",
      "js",
    );
    return { image: normalizedImage };
  }

  // Complex background parsing - split by commas for multiple backgrounds
  const layers = splitBackgroundLayers(backgroundString);

  if (layers.length === 1) {
    return parseBackgroundLayer(layers[0], normalize);
  }

  // Multiple background layers - return array
  return layers.map((layer) => parseBackgroundLayer(layer, normalize));
};

// Parse a single background layer
const parseBackgroundLayer = (layerString, normalize) => {
  const backgroundObj = {};
  const tokens = tokenizeBackground(layerString);

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    // Check for image functions (gradients, url)
    if (isImageFunction(token)) {
      const normalizedImage = normalize(token, "backgroundImage", "js");
      backgroundObj.image = normalizedImage;
    }
    // Check for colors
    else if (isSimpleColor(token)) {
      const normalizedColor = normalize(token, "backgroundColor", "js");
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

// Split background into layers (handle commas not inside functions)
const splitBackgroundLayers = (backgroundString) => {
  const layers = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < backgroundString.length; i++) {
    const char = backgroundString[i];

    if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
    } else if (char === "," && depth === 0) {
      layers.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    layers.push(current.trim());
  }

  return layers;
};

// Tokenize background string into individual values
const tokenizeBackground = (backgroundString) => {
  const tokens = [];
  let current = "";
  let depth = 0;
  let inFunction = false;

  for (let i = 0; i < backgroundString.length; i++) {
    const char = backgroundString[i];

    if (char === "(") {
      depth++;
      inFunction = true;
      current += char;
    } else if (char === ")") {
      depth--;
      current += char;
      if (depth === 0) {
        inFunction = false;
      }
    } else if (char === " " && !inFunction && depth === 0) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = "";
      }
    } else if (char === "/" && !inFunction && depth === 0) {
      // Size separator
      if (current.trim()) {
        tokens.push(current.trim());
        current = "";
      }
      tokens.push("/");
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
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
  // Basic color detection - hex, rgb, hsl, named colors
  return /^(?:#[0-9a-f]{3,8}|rgb|hsl|[a-z]+)/.test(value.toLowerCase());
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
