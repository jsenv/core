import {
  extractContentInfo,
  findPropertyNodeByName,
  isStringLiteralNode,
} from "./helpers.js";

export const isNewInlineContentCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "__InlineContent__"
  );
};
export const analyzeNewInlineContentCall = (
  node,
  { onInlineContent, readInlinedFromUrl },
) => {
  const [firstArg, secondArg] = node.arguments;
  if (!firstArg) {
    return;
  }
  if (!secondArg) {
    return;
  }
  const typePropertyNode = findPropertyNodeByName(secondArg, "type");
  if (!typePropertyNode) {
    return;
  }
  const typePropertyValueNode = typePropertyNode.value;
  if (!isStringLiteralNode(typePropertyValueNode)) {
    return;
  }

  const nodeHoldingContent = firstArg;
  const contentType = typePropertyValueNode.value;
  const contentInfo = extractContentInfo(nodeHoldingContent);
  if (contentInfo) {
    onInlineContent({
      type: "new_inline_content_first_arg",
      contentType,
      inlinedFromUrl: readInlinedFromUrl(node),
      start: nodeHoldingContent.start,
      end: nodeHoldingContent.end,
      line: nodeHoldingContent.loc.start.line,
      column: nodeHoldingContent.loc.start.column,
      lineEnd: nodeHoldingContent.loc.end.line,
      columnEnd: nodeHoldingContent.loc.end.column,
      nodeType: contentInfo.nodeType,
      quote: contentInfo.quote,
      content: contentInfo.content,
      astInfo: { node: nodeHoldingContent },
    });
  }
};
