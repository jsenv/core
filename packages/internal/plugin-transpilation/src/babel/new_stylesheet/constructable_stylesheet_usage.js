import { visitJsAstUntil } from "@jsenv/ast";
import { newStylesheetClientFileUrl } from "./new_stylesheet_client_file_url.js";

export const analyzeConstructableStyleSheetUsage = (urlInfo) => {
  if (urlInfo.url === newStylesheetClientFileUrl) {
    return null;
  }
  const node = visitJsAstUntil(urlInfo.contentAst, {
    NewExpression: (node) => {
      return isNewCssStyleSheetCall(node);
    },
    MemberExpression: (node) => {
      return isDocumentAdoptedStyleSheets(node);
    },
    ImportExpression: (node) => {
      const source = node.source;
      if (source.type !== "Literal" || typeof source.value === "string") {
        // Non-string argument, probably a variable or expression, e.g.
        // import(moduleId)
        // import('./' + moduleName)
        return false;
      }
      if (hasImportTypeCssAssertion(node)) {
        return node;
      }
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      return false;
    },
    ImportDeclaration: (node) => {
      const { source } = node;
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      if (hasImportTypeCssAssertion(node)) {
        return node;
      }
      return false;
    },
    ExportAllDeclaration: (node) => {
      const { source } = node;
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      return false;
    },
    ExportNamedDeclaration: (node) => {
      const { source } = node;
      if (!source) {
        // This export has no "source", so it's probably
        // a local variable or function, e.g.
        // export { varName }
        // export const constName = ...
        // export function funcName() {}
        return false;
      }
      if (hasCssModuleQueryParam(source)) {
        return source;
      }
      return false;
    },
  });
  return node
    ? {
        line: node.loc.start.line,
        column: node.loc.start.column,
      }
    : null;
};

const isNewCssStyleSheetCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "CSSStyleSheet"
  );
};

const isDocumentAdoptedStyleSheets = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "document" &&
    node.property.type === "Identifier" &&
    node.property.name === "adoptedStyleSheets"
  );
};

const hasCssModuleQueryParam = (node) => {
  return (
    node.type === "Literal" &&
    typeof node.value === "string" &&
    new URL(node.value, "https://jsenv.dev").searchParams.has(`css_module`)
  );
};

const hasImportTypeCssAssertion = (node) => {
  const importAssertionsDescriptor = getImportAssertionsDescriptor(
    node.assertions,
  );
  return Boolean(importAssertionsDescriptor.type === "css");
};

const getImportAssertionsDescriptor = (importAssertions) => {
  const importAssertionsDescriptor = {};
  if (importAssertions) {
    importAssertions.forEach((importAssertion) => {
      importAssertionsDescriptor[importAssertion.key.name] =
        importAssertion.value.value;
    });
  }
  return importAssertionsDescriptor;
};
