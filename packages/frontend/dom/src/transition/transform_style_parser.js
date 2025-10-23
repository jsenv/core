export const parseTransform = (transform) => {
  if (!transform || transform === "none") return new Map();
  const transformMap = new Map();

  if (transform.startsWith("matrix(")) {
    // matrix(a, b, c, d, e, f) where e is translateX and f is translateY
    const values = transform
      .match(/matrix\((.*?)\)/)?.[1]
      .split(",")
      .map(Number);
    if (values) {
      const translateX = values[4]; // e value from matrix
      transformMap.set("translateX", { value: translateX, unit: "px" });
      return transformMap;
    }
  }

  // For direct transform functions (when set via style.transform)
  const matches = transform.matchAll(/(\w+)\(([-\d.]+)(%|px|deg)?\)/g);
  for (const match of matches) {
    const [, func, value, unit = ""] = match;
    transformMap.set(func, { value: parseFloat(value), unit });
  }
  return transformMap;
};

export const stringifyTransform = (transformMap) => {
  if (transformMap.size === 0) return "none";
  return Array.from(transformMap.entries())
    .map(([func, { value, unit }]) => `${func}(${value}${unit})`)
    .join(" ");
};
