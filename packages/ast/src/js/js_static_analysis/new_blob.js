import {
  isStringLiteralNode,
  getTypePropertyNode,
  extractContentInfo,
} from "./helpers.js";

export const isNewBlobCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "Blob"
  );
};
export const analyzeNewBlobCall = (node, { onInlineContent }) => {
  const [firstArg, secondArg] = node.arguments;
  if (!firstArg) {
    return;
  }
  if (!secondArg) {
    return;
  }
  if (firstArg.type !== "ArrayExpression") {
    return;
  }
  if (firstArg.elements.length !== 1) {
    return;
  }
  const typePropertyNode = getTypePropertyNode(secondArg);
  if (!typePropertyNode) {
    return;
  }
  const typePropertyValueNode = typePropertyNode.value;
  if (!isStringLiteralNode(typePropertyValueNode)) {
    return;
  }
  const nodeHoldingContent = firstArg.elements[0];
  const contentType = typePropertyValueNode.value;
  const contentInfo = extractContentInfo(nodeHoldingContent);
  if (contentInfo) {
    onInlineContent({
      node: nodeHoldingContent,
      type: "new_blob_first_arg",
      contentType,
      start: nodeHoldingContent.start,
      end: nodeHoldingContent.end,
      line: nodeHoldingContent.loc.start.line,
      column: nodeHoldingContent.loc.start.column,
      lineEnd: nodeHoldingContent.loc.end.line,
      columnEnd: nodeHoldingContent.loc.end.column,
      nodeType: contentInfo.nodeType,
      quote: contentInfo.quote,
      content: contentInfo.content,
    });
  }
};
