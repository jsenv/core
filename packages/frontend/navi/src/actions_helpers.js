export const stringifyForDisplay = (value, maxDepth = 2, currentDepth = 0) => {
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
    if (value.length === 0) return "[]";
    if (value.length > MAX_ENTRIES) {
      const preview = value
        .slice(0, MAX_ENTRIES)
        .map((v) => stringifyForDisplay(v, maxDepth, currentDepth + 1));
      return `[${preview.join(", ")}, ...${value.length - MAX_ENTRIES} more]`;
    }
    const items = value.map((v) =>
      stringifyForDisplay(v, maxDepth, currentDepth + 1),
    );
    return `[${items.join(", ")}]`;
  }

  if (typeof value === "object") {
    if (isSignal(value)) {
      const signalValue = value.peek();
      return `signal(${stringifyForDisplay(signalValue, maxDepth, currentDepth + 1)})`;
    }

    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";

    // ✅ NOUVEAU : Inclure les clés avec valeurs undefined/null
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
            `${k}: ${stringifyForDisplay(v, maxDepth, currentDepth + 1)}`,
        );
      return `{ ${preview.join(", ")}, ...${allEntries.length - MAX_ENTRIES} more }`;
    }

    const pairs = allEntries.map(
      ([k, v]) => `${k}: ${stringifyForDisplay(v, maxDepth, currentDepth + 1)}`,
    );
    return `{ ${pairs.join(", ")} }`;
  }

  return String(value);
};

export const isSignal = (value) => {
  return (
    value &&
    typeof value === "object" &&
    "value" in value &&
    typeof value.peek === "function" &&
    typeof value.subscribe === "function"
  );
};

const MAX_ENTRIES = 5;
