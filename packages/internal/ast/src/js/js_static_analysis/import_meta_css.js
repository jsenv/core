import { getImportMetaPropertyName } from "../import_meta.js";
import { extractContentInfo } from "./helpers.js";

export const isImportMetaCssAssignment = (node) => {
  return (
    node.type === "AssignmentExpression" &&
    node.operator === "=" &&
    getImportMetaPropertyName(node.left) === "css"
  );
};

export const analyzeImportMetaCssAssignment = (node, { onInlineContent }) => {
  // "import.meta.css = [css, url]": the array form a pre-built file ships
  // (see jsenv:import_meta_css); the css is the first element.
  const nodeHoldingContent =
    node.right.type === "ArrayExpression" ? node.right.elements[0] : node.right;
  if (!nodeHoldingContent) {
    return;
  }
  // A template literal with substitutions is not static css: it stays untouched
  // (extractContentInfo returns null for these).
  const contentInfo = extractContentInfo(nodeHoldingContent);
  if (!contentInfo) {
    return;
  }
  onInlineContent({
    type: "import_meta_css_assignment",
    contentType: "text/css",
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
};
