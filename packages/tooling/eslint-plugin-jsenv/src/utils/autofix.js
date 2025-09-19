// Helper function to create autofix for removing a property
export function createRemoveFix(fixer, propNode) {
  const parent = propNode.parent;

  // Find the property index
  let propIndex = -1;
  for (let i = 0; i < parent.properties.length; i++) {
    if (parent.properties[i] === propNode) {
      propIndex = i;
      break;
    }
  }

  if (propIndex === -1) return null;

  const isLast = propIndex === parent.properties.length - 1;

  if (parent.properties.length === 1) {
    // Only property - just remove it
    return fixer.remove(propNode);
  }

  if (isLast) {
    // Last property - remove including preceding comma
    const prevProperty = parent.properties[propIndex - 1];
    const range = [prevProperty.range[1], propNode.range[1]];
    return fixer.removeRange(range);
  }

  // Not last property - remove including following comma
  const nextProperty = parent.properties[propIndex + 1];
  const range = [propNode.range[0], nextProperty.range[0]];
  return fixer.removeRange(range);
}

// Helper function to create autofix for renaming a property
export function createRenameFix(fixer, propNode, newName) {
  if (propNode.key && propNode.key.type === "Identifier") {
    return fixer.replaceText(propNode.key, newName);
  }
  return null;
}

// Helper function to create autofix for JSX attributes
export function createJSXRemoveFix(fixer, attrNode) {
  return fixer.remove(attrNode);
}

export function createJSXRenameFix(fixer, attrNode, newName) {
  if (attrNode.name && attrNode.name.type === "JSXIdentifier") {
    return fixer.replaceText(attrNode.name, newName);
  }
  return null;
}
