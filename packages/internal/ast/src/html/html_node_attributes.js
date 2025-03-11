export const getHtmlNodeAttribute = (htmlNode, attributeName) => {
  const attribute = getHtmlAttributeByName(htmlNode, attributeName);
  return attribute ? attribute.value || "" : undefined;
};

export const getHtmlNodeAttributes = (htmlNode) => {
  const { attrs } = htmlNode;
  if (!attrs) {
    return {};
  }
  const attributes = {};
  for (const attr of attrs) {
    attributes[attr.name] = attr.value;
  }
  return attributes;
};

export const setHtmlNodeAttributes = (htmlNode, attributesToAssign) => {
  if (typeof attributesToAssign !== "object") {
    throw new TypeError(`attributesToAssign must be an object`);
  }
  const { attrs } = htmlNode;
  if (!attrs) return;
  Object.keys(attributesToAssign).forEach((key) => {
    const existingAttributeIndex = attrs.findIndex(({ name }) => name === key);
    const value = attributesToAssign[key];
    // remove no-op
    if (existingAttributeIndex === -1 && value === undefined) {
      return;
    }
    // add
    if (existingAttributeIndex === -1 && value !== undefined) {
      attrs.push({
        name: key,
        value,
      });
      return;
    }
    // remove
    if (value === undefined) {
      attrs.splice(existingAttributeIndex, 1);
      return;
    }
    // update
    attrs[existingAttributeIndex].value = value;
  });
};

const getHtmlAttributeByName = (htmlNode, attributeName) => {
  const { attrs } = htmlNode;
  if (!attrs) {
    return null;
  }
  const attribute = attrs.find((attr) => attr.name === attributeName);
  return attribute;
};
