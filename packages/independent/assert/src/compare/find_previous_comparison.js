// https://github.com/dmail/dom/blob/e55a8c7b4cda6be2f7a4b1222f96d028a379b67f/src/visit.js#L89

export const findPreviousComparison = (comparison, predicate) => {
  const createPreviousIterator = () => {
    let current = comparison;
    const next = () => {
      const previous = getPrevious(current);
      current = previous;
      return {
        done: !previous,
        value: previous,
      };
    };
    return {
      next,
    };
  };

  const iterator = createPreviousIterator();
  let next = iterator.next();
  while (!next.done) {
    const value = next.value;
    if (predicate(value)) {
      return value;
    }
    next = iterator.next();
  }
  return null;
};

const getLastChild = (comparison) => {
  return comparison.children[comparison.children.length - 1];
};

const getDeepestChild = (comparison) => {
  let deepest = getLastChild(comparison);
  while (deepest) {
    const lastChild = getLastChild(deepest);
    if (lastChild) {
      deepest = lastChild;
    } else {
      break;
    }
  }
  return deepest;
};

const getPreviousSibling = (comparison) => {
  const { parent } = comparison;
  if (!parent) return null;
  const { children } = parent;
  const index = children.indexOf(comparison);
  if (index === 0) return null;
  return children[index - 1];
};

const getPrevious = (comparison) => {
  const previousSibling = getPreviousSibling(comparison);
  if (previousSibling) {
    const deepestChild = getDeepestChild(previousSibling);

    if (deepestChild) {
      return deepestChild;
    }
    return previousSibling;
  }
  const parent = comparison.parent;
  return parent;
};
