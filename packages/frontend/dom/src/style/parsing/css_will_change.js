export const parseCSSWillChange = (willChangeString) => {
  if (!willChangeString || typeof willChangeString !== "string") {
    return [];
  }
  if (willChangeString === "auto") {
    return "auto";
  }
  return willChangeString
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

export const stringifyCSSWillChange = (willChangeArray) => {
  if (!Array.isArray(willChangeArray) || willChangeArray.length === 0) {
    return "auto";
  }
  return willChangeArray.join(", ");
};
