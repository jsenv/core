import { extractContentInfo } from "./helpers.js";

export const isJSONParseCall = (node) => {
  const callee = node.callee;
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "JSON" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "parse"
  );
};

export const analyzeJSONParseCall = (node, { onInlineContent }) => {
  const nodeHoldingContent = node.arguments[0];
  const contentInfo = extractContentInfo(nodeHoldingContent);
  if (contentInfo) {
    onInlineContent({
      node: nodeHoldingContent,
      type: "json_parse_first_arg",
      contentType: "application/json",
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
