export const stringifyForDisplay = (
  value,
  maxDepth = 2,
  currentDepth = 0,
  options = {},
) => {
  const { asFunctionArgs = false } = options;
  const indent = "  ".repeat(currentDepth);
  const nextIndent = "  ".repeat(currentDepth + 1);

  if (currentDepth >= maxDepth) {
    return typeof value === "object" && value !== null
      ? "[Object]"
      : String(value);
  }

  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (value instanceof Date) {
    return `Date(${value.toISOString()})`;
  }
  if (value instanceof RegExp) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    const openBracket = asFunctionArgs ? "(" : "[";
    const closeBracket = asFunctionArgs ? ")" : "]";

    if (value.length === 0) return `${openBracket}${closeBracket}`;

    // Display arrays with only one element on a single line
    if (value.length === 1) {
      const item = stringifyForDisplay(
        value[0],
        maxDepth,
        currentDepth + 1,
        options,
      );
      return `${openBracket}${item}${closeBracket}`;
    }

    if (value.length > MAX_ENTRIES) {
      const preview = value
        .slice(0, MAX_ENTRIES)
        .map(
          (v) =>
            `${nextIndent}${stringifyForDisplay(v, maxDepth, currentDepth + 1, options)}`,
        );
      return `${openBracket}\n${preview.join(",\n")},\n${nextIndent}...${value.length - MAX_ENTRIES} more\n${indent}${closeBracket}`;
    }

    const items = value.map(
      (v) =>
        `${nextIndent}${stringifyForDisplay(v, maxDepth, currentDepth + 1, options)}`,
    );
    return `${openBracket}\n${items.join(",\n")}\n${indent}${closeBracket}`;
  }

  if (typeof value === "object") {
    const signalType = getSignalType(value);
    if (signalType) {
      const signalValue = value.peek();
      const prefix = signalType === "computed" ? "computed" : "signal";
      return `${prefix}(${stringifyForDisplay(signalValue, maxDepth, currentDepth, options)})`;
    }

    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";

    // ✅ Inclure les clés avec valeurs undefined/null
    const allEntries = [];
    for (const [key, val] of entries) {
      allEntries.push([key, val]);
    }

    // Ajouter les clés avec undefined (que Object.entries omet)
    const descriptor = Object.getOwnPropertyDescriptors(value);
    for (const [key, desc] of Object.entries(descriptor)) {
      if (desc.value === undefined && !entries.some(([k]) => k === key)) {
        allEntries.push([key, undefined]);
      }
    }

    if (allEntries.length > MAX_ENTRIES) {
      const preview = allEntries
        .slice(0, MAX_ENTRIES)
        .map(
          ([k, v]) =>
            `${nextIndent}${k}: ${stringifyForDisplay(v, maxDepth, currentDepth + 1, options)}`,
        );
      return `{\n${preview.join(",\n")},\n${nextIndent}...${allEntries.length - MAX_ENTRIES} more\n${indent}}`;
    }

    const pairs = allEntries.map(
      ([k, v]) =>
        `${nextIndent}${k}: ${stringifyForDisplay(v, maxDepth, currentDepth + 1, options)}`,
    );
    return `{\n${pairs.join(",\n")}\n${indent}}`;
  }

  return String(value);
};

export const isSignal = (value) => {
  return getSignalType(value) !== null;
};

const BRAND_SYMBOL = Symbol.for("preact-signals");
export const getSignalType = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (value.brand !== BRAND_SYMBOL) {
    return null;
  }

  if (typeof value._fn === "function") {
    return "computed";
  }

  return "signal";
};

const MAX_ENTRIES = 5;
