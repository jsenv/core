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
