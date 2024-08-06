export const getPropertyValueNode = (node) => {
  if (node.subgroup !== "property_entry") {
    return null;
  }
  const valueDescriptorNode = node.childNodeMap.get("value");
  if (!valueDescriptorNode) {
    return null;
  }
  return valueDescriptorNode.childNodeMap.get("entry_value");
};
