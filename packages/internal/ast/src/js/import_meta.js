// "import.meta.<name>" as parsed by acorn: a member expression whose object
// is the "import.meta" meta property. Returns <name>, or null for any other node.
export const getImportMetaPropertyName = (node) => {
  if (node.type !== "MemberExpression" || node.computed) {
    return null;
  }
  const { object, property } = node;
  if (
    object.type !== "MetaProperty" ||
    object.meta.name !== "import" ||
    object.property.name !== "meta"
  ) {
    return null;
  }
  return property.name;
};
