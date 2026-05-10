// Temporarily attach to the element so inherited CSS vars resolve correctly,
// then snapshot all drop-hint custom properties onto the scroll container
// so they survive once the element moves to the scroll container.
export const moveCSSVars = (vars, fromEl, toEl) => {
  const fromComputedStyle = getComputedStyle(fromEl);
  const savedVars = {};
  for (const varName of vars) {
    const value = fromComputedStyle.getPropertyValue(varName).trim();
    if (value) {
      savedVars[varName] = toEl.style.getPropertyValue(varName);
      toEl.style.setProperty(varName, value);
    }
  }

  return () => {
    for (const varName of vars) {
      if (varName in savedVars) {
        if (savedVars[varName]) {
          toEl.style.setProperty(varName, savedVars[varName]);
        } else {
          toEl.style.removeProperty(varName);
        }
      }
    }
  };
};
