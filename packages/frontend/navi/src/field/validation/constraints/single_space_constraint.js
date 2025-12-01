export const SINGLE_SPACE_CONSTRAINT = {
  name: "single_space",
  check: (element) => {
    const singleSpace = element.hasAttribute("data-single-space");
    if (!singleSpace) {
      return null;
    }
    const inputValue = element.value;
    const hasLeadingSpace = inputValue.startsWith(" ");
    const hasTrailingSpace = inputValue.endsWith(" ");
    const hasDoubleSpace = inputValue.includes("  ");
    if (hasLeadingSpace || hasDoubleSpace || hasTrailingSpace) {
      const messageAttribute = element.getAttribute(
        "data-single-space-message",
      );
      if (messageAttribute) {
        return messageAttribute;
      }
      if (hasLeadingSpace) {
        return "Les espaces au début ne sont pas autorisés.";
      }
      if (hasTrailingSpace) {
        return "Les espaces à la fin ne sont pas autorisés.";
      }
      return "Les espaces consécutifs ne sont pas autorisés.";
    }
    return "";
  },
};
