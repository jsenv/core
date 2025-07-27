export const findFirstAncestor = (node, predicate) => {
  let ancestor = node.parentNode;
  while (ancestor) {
    if (predicate(ancestor)) {
      return ancestor;
    }
    ancestor = ancestor.parentNode;
  }
  return null;
};

export const findFirstDescendant = (rootNode, fn, skipRoot) => {
  const iterator = createNextNodeIterator(rootNode, rootNode);
  let { done, value: node } = iterator.next();
  while (done === false) {
    let skipChildren = false;
    if (node === skipRoot) {
      skipChildren = true;
    } else {
      const skip = () => {
        skipChildren = true;
      };
      if (fn(node, skip)) {
        return node;
      }
    }
    ({ done, value: node } = iterator.next(skipChildren));
  }
  return null;
};

export const findLastDescendant = (rootNode, fn) => {
  const deepestNode = getDeepestNode(rootNode);
  if (deepestNode) {
    const iterator = createPreviousNodeIterator(deepestNode, rootNode);
    let { done, value: node } = iterator.next();
    while (done === false) {
      if (fn(node)) {
        return node;
      }
      ({ done, value: node } = iterator.next());
    }
  }
  return null;
};

export const findAfter = (
  from,
  predicate,
  { root = null, skipRoot = null, skipChildren = false } = {},
) => {
  const iterator = createAfterNodeIterator(from, root, skipChildren);
  let { done, value: node } = iterator.next();
  while (done === false) {
    let innerSkipChildren = false;
    if (node === skipRoot) {
      innerSkipChildren = true;
    } else if (predicate(node)) {
      return node;
    }
    ({ done, value: node } = iterator.next(innerSkipChildren));
  }
  return null;
};

export const findAfterSkippingChildren = (param) =>
  findAfter({ ...param, skipChildren: true });

export const findBefore = (from, predicate, { root = null } = {}) => {
  const iterator = createPreviousNodeIterator(from, root);
  let { done, value: node } = iterator.next();
  while (done === false) {
    if (predicate(node)) {
      return node;
    }
    ({ done, value: node } = iterator.next());
  }
  return null;
};

const getNextNode = (node, rootNode, skipChild = false) => {
  if (!skipChild) {
    const firstChild = node.firstChild;
    if (firstChild) {
      return firstChild;
    }
  }

  const nextSibling = node.nextSibling;
  if (nextSibling) {
    return nextSibling;
  }

  const parentNode = node.parentNode;
  if (parentNode && parentNode !== rootNode) {
    return getNextNode(parentNode, rootNode, true);
  }

  return null;
};

const createNextNodeIterator = (node, rootNode) => {
  let current = node;
  const next = (innerSkipChildren = false) => {
    const nextNode = getNextNode(current, rootNode, innerSkipChildren);
    current = nextNode;
    return {
      done: Boolean(nextNode) === false,
      value: nextNode,
    };
  };
  return { next };
};

const createAfterNodeIterator = (fromNode, rootNode, skipChildren = false) => {
  let current = fromNode;
  let childrenSkipped = false;
  const next = (innerSkipChildren = false) => {
    const nextNode = getNextNode(
      current,
      rootNode,
      (skipChildren && childrenSkipped === false) || innerSkipChildren,
    );
    childrenSkipped = true;
    current = nextNode;
    return {
      done: Boolean(nextNode) === false,
      value: nextNode,
    };
  };
  return { next };
};

const getDeepestNode = (node) => {
  let deepestNode = node.lastChild;
  while (deepestNode) {
    const lastChild = deepestNode.lastChild;
    if (lastChild) {
      deepestNode = lastChild;
    } else {
      break;
    }
  }
  return deepestNode;
};

const getPreviousNode = (node, rootNode) => {
  const previousSibling = node.previousSibling;
  if (previousSibling) {
    const deepestChild = getDeepestNode(previousSibling);

    if (deepestChild) {
      return deepestChild;
    }
    return previousSibling;
  }
  if (node !== rootNode) {
    const parentNode = node.parentNode;
    if (parentNode && parentNode !== rootNode) {
      return parentNode;
    }
  }
  return null;
};

const createPreviousNodeIterator = (fromNode, rootNode) => {
  let current = fromNode;
  const next = () => {
    const previousNode = getPreviousNode(current, rootNode);
    current = previousNode;
    return {
      done: Boolean(previousNode) === false,
      value: previousNode,
    };
  };
  return {
    next,
  };
};
