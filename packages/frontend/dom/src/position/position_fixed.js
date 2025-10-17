export const findAncestorFixedPosition = (element) => {
  let current = element.parentElement;
  while (current && current !== document.documentElement) {
    const computedStyle = window.getComputedStyle(current);
    if (computedStyle.position === "fixed") {
      const { left, top } = current.getBoundingClientRect();
      return [left, top];
    }
    current = current.parentElement;
  }
  return null;
};
