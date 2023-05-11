export const comparisonToRootComparison = (comparison) => {
  let current = comparison;
  while (current) {
    if (current.parent) {
      current = current.parent;
    } else {
      break;
    }
  }
  return current;
};
