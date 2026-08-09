/**
 * First ancestor of `node` matching `predicate`, walking parent by parent.
 * Starts at the parent — `node` itself is never a candidate.
 *
 * @param {Node} node
 * @param {(ancestor: Node) => boolean} predicate
 * @returns {Node|null}
 */
export const findAncestor = (node, predicate) => {
  let ancestor = node.parentNode;
  while (ancestor) {
    if (predicate(ancestor)) {
      return ancestor;
    }
    ancestor = ancestor.parentNode;
  }
  return null;
};

/**
 * First descendant of `rootNode` matching `fn`, in document order (depth
 * first). The walk is bounded to the subtree: `rootNode` itself is not a
 * candidate, and a root with no children yields nothing — never the root's
 * siblings.
 *
 * @param {Node} rootNode
 * @param {(node: Node, skip: () => void) => boolean} fn - Return true to stop
 *   on `node`. Call `skip()` to not descend into `node`'s children (the walk
 *   goes on with its siblings).
 * @param {object} [options]
 * @param {Node} [options.skipRoot] - A subtree to leave out entirely, itself
 *   included.
 * @returns {Node|null}
 */
export const findDescendant = (rootNode, fn, { skipRoot } = {}) => {
  const iterator = createNextNodeIterator(rootNode, rootNode, skipRoot);
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

/**
 * Last descendant of `rootNode` matching `fn` in document order — the walk
 * starts at the subtree's deepest final node and moves backwards, so the
 * first match it meets is the last one the document holds.
 *
 * @param {Node} rootNode
 * @param {(node: Node) => boolean} fn
 * @param {object} [options]
 * @param {Node} [options.skipRoot] - A subtree to leave out entirely, itself
 *   included.
 * @returns {Node|null}
 */
export const findLastDescendant = (rootNode, fn, { skipRoot } = {}) => {
  const deepestNode = getDeepestNode(rootNode, skipRoot);
  if (deepestNode) {
    const iterator = createPreviousNodeIterator(
      deepestNode,
      rootNode,
      skipRoot,
    );
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

/**
 * First node after `from` in document order matching `predicate`. Unlike
 * findDescendant this is anchored to a position, not a container: the walk
 * leaves `from`'s subtree and goes on through its siblings and its ancestors'
 * siblings, until `root`'s subtree is exhausted.
 *
 * @param {Node} from - The position to search from; not a candidate itself.
 * @param {(node: Node) => boolean} predicate
 * @param {object} [options]
 * @param {Node} [options.root] - Bounds the walk to its subtree; null walks to
 *   the end of the tree `from` belongs to.
 * @param {Node} [options.skipRoot] - A subtree to leave out entirely, itself
 *   included. A `from` inside it starts right after it.
 * @param {boolean} [options.skipChildren] - Do not look inside `from`; start
 *   at what follows it.
 * @returns {Node|null}
 */
export const findAfter = (
  from,
  predicate,
  { root = null, skipRoot = null, skipChildren = false } = {},
) => {
  const iterator = createAfterNodeIterator(from, root, skipChildren, skipRoot);
  let { done, value: node } = iterator.next();
  while (done === false) {
    if (predicate(node)) {
      return node;
    }
    ({ done, value: node } = iterator.next());
  }
  return null;
};

/**
 * First node before `from` in reverse document order matching `predicate` —
 * what findAfter is to "next", this is to "previous". A step back lands on
 * the previous sibling's DEEPEST last node (document order walked backwards),
 * not on the sibling itself.
 *
 * @param {Node} from - The position to search from; not a candidate itself.
 * @param {(node: Node) => boolean} predicate
 * @param {object} [options]
 * @param {Node} [options.root] - Bounds the walk to its subtree; null walks
 *   back to the start of the tree `from` belongs to.
 * @param {Node} [options.skipRoot] - A subtree to leave out entirely, itself
 *   included. A `from` inside it starts right before it.
 * @returns {Node|null}
 */
export const findBefore = (
  from,
  predicate,
  { root = null, skipRoot = null } = {},
) => {
  const iterator = createPreviousNodeIterator(from, root, skipRoot);
  let { done, value: node } = iterator.next();
  while (done === false) {
    if (predicate(node)) {
      return node;
    }
    ({ done, value: node } = iterator.next());
  }
  return null;
};

const getNextNode = (node, rootNode, skipChild = false, skipRoot = null) => {
  if (!skipChild) {
    const firstChild = node.firstChild;
    if (firstChild) {
      // If the first child is skipRoot or inside skipRoot, skip it
      if (
        skipRoot &&
        (firstChild === skipRoot || skipRoot.contains(firstChild))
      ) {
        // Skip this entire subtree by going to next sibling or up
        return getNextNode(node, rootNode, true, skipRoot);
      }
      return firstChild;
    }
  }

  // The traversal is bounded to rootNode's subtree: the root's own siblings
  // are not part of it. Without this, a rootNode with no children (asking
  // findDescendant about an <input>, say) steps to its next sibling and walks
  // the rest of the document from there — the parentNode guard below never
  // catches it because the walk is already outside the root.
  if (node === rootNode) {
    return null;
  }

  const nextSibling = node.nextSibling;
  if (nextSibling) {
    // If next sibling is skipRoot, skip it entirely
    if (skipRoot && nextSibling === skipRoot) {
      return getNextNode(nextSibling, rootNode, true, skipRoot);
    }
    return nextSibling;
  }

  const parentNode = node.parentNode;
  if (parentNode && parentNode !== rootNode) {
    return getNextNode(parentNode, rootNode, true, skipRoot);
  }

  return null;
};

const createNextNodeIterator = (node, rootNode, skipRoot = null) => {
  let current = node;
  const next = (innerSkipChildren = false) => {
    const nextNode = getNextNode(
      current,
      rootNode,
      innerSkipChildren,
      skipRoot,
    );
    current = nextNode;
    return {
      done: Boolean(nextNode) === false,
      value: nextNode,
    };
  };
  return { next };
};

const createAfterNodeIterator = (
  fromNode,
  rootNode,
  skipChildren = false,
  skipRoot = null,
) => {
  let current = fromNode;
  let childrenSkipped = false;

  // If we're inside skipRoot, we need to start searching after skipRoot entirely
  if (skipRoot && (fromNode === skipRoot || skipRoot.contains(fromNode))) {
    current = skipRoot;
    childrenSkipped = true; // Mark that we've already "processed" this node
    skipChildren = true; // Force skip children to exit the skipRoot subtree
  }

  const next = (innerSkipChildren = false) => {
    const nextNode = getNextNode(
      current,
      rootNode,
      (skipChildren && childrenSkipped === false) || innerSkipChildren,
      skipRoot,
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

const getDeepestNode = (node, skipRoot = null) => {
  let deepestNode = node.lastChild;
  while (deepestNode) {
    // If we hit skipRoot or enter its subtree, stop going deeper
    if (
      skipRoot &&
      (deepestNode === skipRoot || skipRoot.contains(deepestNode))
    ) {
      // Try the previous sibling instead
      const previousSibling = deepestNode.previousSibling;
      if (previousSibling) {
        return getDeepestNode(previousSibling, skipRoot);
      }
      // If no previous sibling, return the parent (which should be safe)
      return deepestNode.parentNode === node ? null : deepestNode.parentNode;
    }

    const lastChild = deepestNode.lastChild;
    if (lastChild) {
      deepestNode = lastChild;
    } else {
      break;
    }
  }
  return deepestNode;
};

const getPreviousNode = (node, rootNode, skipRoot = null) => {
  const previousSibling = node.previousSibling;
  if (previousSibling) {
    // If previous sibling is skipRoot, skip it entirely
    if (skipRoot && previousSibling === skipRoot) {
      return getPreviousNode(previousSibling, rootNode, skipRoot);
    }

    const deepestChild = getDeepestNode(previousSibling, skipRoot);

    // Check if deepest child is inside skipRoot (shouldn't happen with updated getDeepestNode, but safe check)
    if (
      skipRoot &&
      deepestChild &&
      (deepestChild === skipRoot || skipRoot.contains(deepestChild))
    ) {
      // Skip this sibling entirely and try the next one
      return getPreviousNode(previousSibling, rootNode, skipRoot);
    }

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

const createPreviousNodeIterator = (fromNode, rootNode, skipRoot = null) => {
  let current = fromNode;

  // If we're inside skipRoot, we need to start searching before skipRoot entirely
  if (skipRoot && (fromNode === skipRoot || skipRoot.contains(fromNode))) {
    current = skipRoot;
  }

  const next = () => {
    const previousNode = getPreviousNode(current, rootNode, skipRoot);
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
