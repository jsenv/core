import { parseCSSColor, stringifyCSSColor } from "./css_color.js";
import { tokenizeCSS } from "./css_tokenizer.js";

// Convert image object to CSS string
export const stringifyCSSImage = (imageObj) => {
  if (typeof imageObj === "string") {
    return imageObj;
  }

  if (typeof imageObj !== "object" || imageObj === null) {
    return imageObj;
  }

  switch (imageObj.type) {
    case "url":
      return `url(${imageObj.value})`;

    case "linear-gradient":
      return stringifyLinearGradient(imageObj);

    case "radial-gradient":
      return stringifyRadialGradient(imageObj);

    case "conic-gradient":
      return stringifyConicGradient(imageObj);

    case "repeating-linear-gradient":
      return `repeating-${stringifyLinearGradient(imageObj)}`;

    case "repeating-radial-gradient":
      return `repeating-${stringifyRadialGradient(imageObj)}`;

    case "repeating-conic-gradient":
      return `repeating-${stringifyConicGradient(imageObj)}`;

    default:
      // Fallback for unknown types
      return imageObj.original || "none";
  }
};

// Parse CSS image string into structured object
export const parseCSSImage = (imageString, element) => {
  if (!imageString || imageString === "none") {
    return undefined;
  }

  if (typeof imageString !== "string") {
    return imageString;
  }

  const trimmed = imageString.trim();

  // Parse URL
  const urlMatch = trimmed.match(/^url\s*\(([^)]*)\)$/);
  if (urlMatch) {
    return {
      type: "url",
      value: cleanUrlValue(urlMatch[1]),
      original: trimmed,
    };
  }

  // Parse gradients
  const gradientMatch = trimmed.match(
    /^(repeating-)?(linear-gradient|radial-gradient|conic-gradient)\s*\(([\s\S]*)\)$/,
  );
  if (gradientMatch) {
    const [, repeating, gradientType, content] = gradientMatch;
    const type = repeating ? `repeating-${gradientType}` : gradientType;

    switch (gradientType) {
      case "linear-gradient":
        return parseLinearGradient(content, type, trimmed, element);
      case "radial-gradient":
        return parseRadialGradient(content, type, trimmed, element);
      case "conic-gradient":
        return parseConicGradient(content, type, trimmed, element);
    }
  }

  // Other image functions (element, cross-fade, etc.)
  const functionMatch = trimmed.match(/^([a-z-]+)\s*\(([\s\S]*)\)$/);
  if (functionMatch) {
    return {
      type: functionMatch[1],
      content: functionMatch[2],
      original: trimmed,
    };
  }

  // Fallback for unrecognized values
  return {
    type: "unknown",
    value: trimmed,
    original: trimmed,
  };
};

// Helper functions for gradient parsing
const parseLinearGradient = (content, type, original, element) => {
  const { direction, colors } = parseGradientContent(content, element, {
    isRadial: false,
  });

  return {
    type,
    direction: direction || "to bottom",
    colors,
    original,
  };
};

const parseRadialGradient = (content, type, original, element) => {
  const { shape, colors } = parseGradientContent(content, element, {
    isRadial: true,
  });

  return {
    type,
    shape: shape || "ellipse",
    colors,
    original,
  };
};

const parseConicGradient = (content, type, original, element) => {
  const { direction, colors } = parseGradientContent(content, element, {
    isRadial: true,
  });

  return {
    type,
    from: direction || "0deg",
    colors,
    original,
  };
};

// Parse gradient content (colors and direction/shape)
const parseGradientContent = (content, element, { isRadial }) => {
  const parts = tokenizeCSS(content, { separators: [","] });
  const colors = [];
  let direction = null;
  let shape = null;

  for (const part of parts) {
    const trimmedPart = part.trim();

    // Check if it's a direction/shape (before any colors)
    if (colors.length === 0) {
      if (isRadial && isRadialShape(trimmedPart)) {
        shape = trimmedPart;
        continue;
      } else if (!isRadial && isLinearDirection(trimmedPart)) {
        direction = trimmedPart;
        continue;
      } else if (!isRadial && trimmedPart.startsWith("from ")) {
        // Conic gradient "from" direction
        direction = trimmedPart;
        continue;
      }
    }

    // Parse as color stop
    const colorStop = parseColorStop(trimmedPart, element);
    if (colorStop) {
      colors.push(colorStop);
    }
  }

  return { direction, shape, colors };
};

// Parse individual color stop
const parseColorStop = (stopString, element) => {
  const trimmed = stopString.trim();

  // Match color with optional position
  // Examples: "red", "red 50%", "#ff0000 25% 75%", "rgba(255,0,0,0.5)"
  const colorMatch = trimmed.match(
    /^((?:rgb|hsl)a?\([^)]*\)|#[a-f0-9]{3,8}|[a-z](?:[a-z-]*[a-z])?|var\([^)]*\))(?:\s+([\d.]+%?(?:\s+[\d.]+%?)*))?$/i,
  );

  if (colorMatch) {
    const [, color, positions] = colorMatch;
    const stopStrings = positions ? positions.split(/\s+/) : [];

    // Parse stop positions into structured objects
    const stops =
      stopStrings.length > 0
        ? stopStrings.map((stop) => {
            const match = stop.match(/^([+-]?\d+(?:\.\d+)?|\d*\.\d+)(\D*)$/);
            if (match) {
              return {
                isNumeric: true,
                value: parseFloat(match[1]),
                unit: match[2] || "",
              };
            }
            return {
              isNumeric: false,
              value: stop,
              unit: "",
            };
          })
        : undefined;

    return {
      color: parseCSSColor(color.trim(), element),
      stops,
    };
  }

  return null;
};

// Direction/shape detection helpers
const isLinearDirection = (value) => {
  return (
    value.includes("deg") ||
    value.includes("turn") ||
    value.includes("rad") ||
    value.includes("grad") ||
    value.startsWith("to ") ||
    ["top", "bottom", "left", "right"].some((dir) => value.includes(dir))
  );
};

const isRadialShape = (value) => {
  return (
    value.includes("circle") ||
    value.includes("ellipse") ||
    value.includes("at ") ||
    value.includes("closest") ||
    value.includes("farthest")
  );
};

// Stringification helpers
const stringifyLinearGradient = (gradientObj) => {
  const parts = [];

  if (gradientObj.direction && gradientObj.direction !== "to bottom") {
    parts.push(gradientObj.direction);
  }

  if (gradientObj.colors) {
    parts.push(...gradientObj.colors.map(stringifyColorStop));
  }

  return `linear-gradient(${parts.join(", ")})`;
};

const stringifyRadialGradient = (gradientObj) => {
  const parts = [];

  if (gradientObj.shape && gradientObj.shape !== "ellipse") {
    parts.push(gradientObj.shape);
  }

  if (gradientObj.colors) {
    parts.push(...gradientObj.colors.map(stringifyColorStop));
  }

  return `radial-gradient(${parts.join(", ")})`;
};

const stringifyConicGradient = (gradientObj) => {
  const parts = [];

  if (gradientObj.from && gradientObj.from !== "0deg") {
    parts.push(`from ${gradientObj.from}`);
  }

  if (gradientObj.colors) {
    parts.push(...gradientObj.colors.map(stringifyColorStop));
  }

  return `conic-gradient(${parts.join(", ")})`;
};

const stringifyColorStop = (colorStop) => {
  if (typeof colorStop === "string") {
    return colorStop;
  }

  // Convert color back to CSS string (handles both strings and structured colors)
  const colorString =
    typeof colorStop.color === "string"
      ? colorStop.color
      : stringifyCSSColor(colorStop.color);
  const parts = [colorString];

  if (colorStop.stops) {
    // Handle structured stop objects
    const stopStrings = colorStop.stops.map((stop) => {
      if (typeof stop === "string") {
        return stop;
      }
      // If it's a parsed object, reconstruct the string
      if (stop.isNumeric) {
        return `${stop.value}${stop.unit}`;
      }
      return stop.value;
    });
    parts.push(...stopStrings);
  }

  return parts.join(" ");
};

// Helper to clean URL values (remove quotes)
const cleanUrlValue = (urlValue) => {
  const trimmed = urlValue.trim();
  // Remove surrounding quotes if present
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};
