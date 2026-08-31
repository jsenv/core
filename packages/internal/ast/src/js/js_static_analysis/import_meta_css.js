import { getImportMetaPropertyName } from "../import_meta.js";
import { buildCssTemplateSubstitutions } from "./css_template_substitutions.js";
import { extractContentInfo } from "./helpers.js";

export const isImportMetaCssAssignment = (node) => {
  return (
    node.type === "AssignmentExpression" &&
    node.operator === "=" &&
    getImportMetaPropertyName(node.left) === "css"
  );
};

export const analyzeImportMetaCssAssignment = (
  node,
  { js, ast, ancestors, onInlineContent },
) => {
  // "import.meta.css = [css, url]": the array form a pre-built file ships
  // (see jsenv:import_meta_css); the css is the first element.
  const assignedNode =
    node.right.type === "ArrayExpression" ? node.right.elements[0] : node.right;
  if (!assignedNode) {
    return;
  }
  // "const css = `...`; import.meta.css = css;" — the css is where the constant
  // is declared. Resolved only for an assignment sitting at the top level of the
  // module, where the name can only be the module's own constant.
  const nodeHoldingContent =
    assignedNode.type === "Identifier"
      ? findModuleConstantValue(assignedNode.name, { ast, ancestors })
      : assignedNode;
  if (!nodeHoldingContent) {
    return;
  }
  const position = {
    start: nodeHoldingContent.start,
    end: nodeHoldingContent.end,
    line: nodeHoldingContent.loc.start.line,
    column: nodeHoldingContent.loc.start.column,
    lineEnd: nodeHoldingContent.loc.end.line,
    columnEnd: nodeHoldingContent.loc.end.column,
  };
  const contentInfo = extractContentInfo(nodeHoldingContent);
  if (contentInfo) {
    onInlineContent({
      type: "import_meta_css_assignment",
      contentType: "text/css",
      ...position,
      nodeType: contentInfo.nodeType,
      quote: contentInfo.quote,
      content: contentInfo.content,
      astInfo: { node: nodeHoldingContent },
    });
    return;
  }
  if (nodeHoldingContent.type !== "TemplateLiteral") {
    return;
  }
  const substitutionInfo = buildCssTemplateSubstitutions(
    nodeHoldingContent,
    js,
  );
  if (!substitutionInfo) {
    return;
  }
  onInlineContent({
    type: "import_meta_css_assignment",
    contentType: "text/css",
    ...position,
    nodeType: "TemplateLiteral",
    quote: "`",
    content: substitutionInfo.content,
    substitutions: substitutionInfo.substitutions,
    astInfo: { node: nodeHoldingContent },
  });
};

const findModuleConstantValue = (name, { ast, ancestors }) => {
  const isTopLevelAssignment =
    ancestors.length === 3 &&
    ancestors[0].type === "Program" &&
    ancestors[1].type === "ExpressionStatement";
  if (!isTopLevelAssignment) {
    // a name read from inside a function can be a local one
    return null;
  }
  for (const node of ast.body) {
    const declaration =
      node.type === "ExportNamedDeclaration" ? node.declaration : node;
    if (!declaration || declaration.type !== "VariableDeclaration") {
      continue;
    }
    if (declaration.kind !== "const") {
      // the value read at assignment time is not the one written here
      continue;
    }
    for (const declarator of declaration.declarations) {
      if (declarator.id.type === "Identifier" && declarator.id.name === name) {
        return declarator.init;
      }
    }
  }
  return null;
};
