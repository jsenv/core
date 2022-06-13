import { pathToFileURL } from "node:url";
import { injectImport } from "@jsenv/utils/js_ast/babel_utils.js";
export const babelPluginNewStylesheetAsJsenvImport = (babel, {
  getImportSpecifier
}) => {
  const newStylesheetClientFileUrl = new URL("../../../../../js/new_stylesheet.js", import.meta.url).href;
  return {
    name: "new-stylesheet-as-jsenv-import",
    visitor: {
      Program: (programPath, {
        filename
      }) => {
        const fileUrl = pathToFileURL(filename).href;

        if (fileUrl === newStylesheetClientFileUrl) {
          return;
        }

        let usesNewStylesheet = false;
        programPath.traverse({
          NewExpression: path => {
            usesNewStylesheet = isNewCssStyleSheetCall(path.node);

            if (usesNewStylesheet) {
              path.stop();
            }
          },
          MemberExpression: path => {
            usesNewStylesheet = isDocumentAdoptedStyleSheets(path.node);

            if (usesNewStylesheet) {
              path.stop();
            }
          },
          CallExpression: path => {
            if (path.node.callee.type !== "Import") {
              // Some other function call, not import();
              return;
            }

            if (path.node.arguments[0].type !== "StringLiteral") {
              // Non-string argument, probably a variable or expression, e.g.
              // import(moduleId)
              // import('./' + moduleName)
              return;
            }

            const sourcePath = path.get("arguments")[0];
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath) || hasImportTypeCssAssertion(path);

            if (usesNewStylesheet) {
              path.stop();
            }
          },
          ImportDeclaration: path => {
            const sourcePath = path.get("source");
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath) || hasImportTypeCssAssertion(path);

            if (usesNewStylesheet) {
              path.stop();
            }
          },
          ExportAllDeclaration: path => {
            const sourcePath = path.get("source");
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath);

            if (usesNewStylesheet) {
              path.stop();
            }
          },
          ExportNamedDeclaration: path => {
            if (!path.node.source) {
              // This export has no "source", so it's probably
              // a local variable or function, e.g.
              // export { varName }
              // export const constName = ...
              // export function funcName() {}
              return;
            }

            const sourcePath = path.get("source");
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath);

            if (usesNewStylesheet) {
              path.stop();
            }
          }
        });

        if (usesNewStylesheet) {
          injectImport({
            programPath,
            from: getImportSpecifier(newStylesheetClientFileUrl),
            sideEffect: true
          });
        }
      }
    }
  };
};

const isNewCssStyleSheetCall = node => {
  return node.type === "NewExpression" && node.callee.type === "Identifier" && node.callee.name === "CSSStyleSheet";
};

const isDocumentAdoptedStyleSheets = node => {
  return node.type === "MemberExpression" && node.object.type === "Identifier" && node.object.name === "document" && node.property.type === "Identifier" && node.property.name === "adoptedStyleSheets";
};

const hasCssModuleQueryParam = path => {
  const {
    node
  } = path;
  return node.type === "StringLiteral" && new URL(node.value, "https://jsenv.dev").searchParams.has(`css_module`);
};

const hasImportTypeCssAssertion = path => {
  const importAssertionsDescriptor = getImportAssertionsDescriptor(path.node.assertions);
  return Boolean(importAssertionsDescriptor.type === "css");
};

const getImportAssertionsDescriptor = importAssertions => {
  const importAssertionsDescriptor = {};

  if (importAssertions) {
    importAssertions.forEach(importAssertion => {
      importAssertionsDescriptor[importAssertion.key.name] = importAssertion.value.value;
    });
  }

  return importAssertionsDescriptor;
};