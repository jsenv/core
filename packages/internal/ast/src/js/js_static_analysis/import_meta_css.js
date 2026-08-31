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
  // is declared, and that is where it is read and rewritten.
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
  if (isShadowed(name, ancestors)) {
    // the name stands for something declared closer than the module
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

// Walks out from the assignment towards the module: a name declared on the way
// is not the module constant, whatever the module declares under it.
const isShadowed = (name, ancestors) => {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const node = ancestors[i];
    if (node.type === "Program") {
      return false;
    }
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      for (const param of node.params) {
        if (patternDeclares(param, name)) {
          return true;
        }
      }
      continue;
    }
    if (node.type === "CatchClause") {
      if (node.param && patternDeclares(node.param, name)) {
        return true;
      }
      continue;
    }
    if (node.type === "BlockStatement" || node.type === "StaticBlock") {
      if (bodyDeclares(node.body, name)) {
        return true;
      }
      continue;
    }
    if (
      node.type === "ForStatement" ||
      node.type === "ForInStatement" ||
      node.type === "ForOfStatement"
    ) {
      const init = node.init || node.left;
      if (init && init.type === "VariableDeclaration") {
        for (const declarator of init.declarations) {
          if (patternDeclares(declarator.id, name)) {
            return true;
          }
        }
      }
      continue;
    }
  }
  return false;
};

const bodyDeclares = (body, name) => {
  for (const node of body) {
    if (node.type === "VariableDeclaration") {
      for (const declarator of node.declarations) {
        if (patternDeclares(declarator.id, name)) {
          return true;
        }
      }
      continue;
    }
    if (
      (node.type === "FunctionDeclaration" ||
        node.type === "ClassDeclaration") &&
      node.id &&
      node.id.name === name
    ) {
      return true;
    }
  }
  return false;
};

const patternDeclares = (pattern, name) => {
  if (!pattern) {
    return false;
  }
  if (pattern.type === "Identifier") {
    return pattern.name === name;
  }
  if (pattern.type === "AssignmentPattern") {
    return patternDeclares(pattern.left, name);
  }
  if (pattern.type === "RestElement") {
    return patternDeclares(pattern.argument, name);
  }
  if (pattern.type === "ArrayPattern") {
    return pattern.elements.some((element) => patternDeclares(element, name));
  }
  if (pattern.type === "ObjectPattern") {
    return pattern.properties.some((property) =>
      patternDeclares(
        property.type === "RestElement" ? property.argument : property.value,
        name,
      ),
    );
  }
  return false;
};
