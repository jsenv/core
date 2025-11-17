// Shared tokenization utilities for CSS parsing

// Tokenize CSS string into individual values, respecting function boundaries
export const tokenizeCSS = (cssString, options = {}) => {
  const {
    separators = [" "],
    preserveSeparators = false,
    respectFunctions = true,
  } = options;

  const tokens = [];
  let current = "";
  let depth = 0;
  let inFunction = false;

  for (let i = 0; i < cssString.length; i++) {
    const char = cssString[i];

    if (respectFunctions && char === "(") {
      depth++;
      inFunction = true;
      current += char;
    } else if (respectFunctions && char === ")") {
      depth--;
      current += char;
      if (depth === 0) {
        inFunction = false;
      }
    } else if (
      separators.includes(char) &&
      (!respectFunctions || (!inFunction && depth === 0))
    ) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = "";
      }
      if (preserveSeparators) {
        tokens.push(char);
      }
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
};

// Split CSS string into layers/sections (handle commas not inside functions)
export const splitCSSLayers = (cssString) => {
  const layers = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < cssString.length; i++) {
    const char = cssString[i];

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
