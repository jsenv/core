import { toChildArray } from "preact";

export const applyContentSpacingOnTextChildren = (children, contentSpacing) => {
  if (contentSpacing === "pre") {
    return children;
  }
  if (!children) {
    return children;
  }
  const childArray = toChildArray(children);
  const childCount = childArray.length;
  if (childCount <= 1) {
    return children;
  }

  // Helper function to check if a value ends with whitespace
  const endsWithWhitespace = (value) => {
    if (typeof value === "string") {
      return /\s$/.test(value);
    }
    return false;
  };

  // Helper function to check if a value starts with whitespace
  const startsWithWhitespace = (value) => {
    if (typeof value === "string") {
      return /^\s/.test(value);
    }
    return false;
  };

  const separator = contentSpacing === undefined ? " " : contentSpacing;

  const childrenWithGap = [];
  let i = 0;
  while (true) {
    const child = childArray[i];
    childrenWithGap.push(child);
    i++;
    if (i === childCount) {
      break;
    }

    // Check if we should skip adding contentSpacing
    const currentChild = childArray[i - 1];
    const nextChild = childArray[i];
    const shouldSkipSpacing =
      endsWithWhitespace(currentChild) || startsWithWhitespace(nextChild);

    if (!shouldSkipSpacing) {
      childrenWithGap.push(separator);
    }
  }
  return childrenWithGap;
};
