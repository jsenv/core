export const SINGLE_SPACE_CONSTRAINT = {
  name: "single_space",
  check: (input) => {
    const inputValue = input.value;
    const hasLeadingSpace = inputValue.startsWith(" ");
    const hasTrailingSpace = inputValue.endsWith(" ");
    const hasDoubleSpace = inputValue.includes("  ");
    if (hasLeadingSpace || hasDoubleSpace || hasTrailingSpace) {
      return "Spaces at the beginning, end, or consecutive spaces are not allowed";
    }
    return "";
  },
};
