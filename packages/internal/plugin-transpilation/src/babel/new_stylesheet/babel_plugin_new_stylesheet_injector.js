import { pathToFileURL } from "node:url";
import { injectPolyfillIntoBabelAst } from "../polyfill_injection_in_babel_ast.js";

const newStylesheetClientFileUrl = new URL(
  "./client/new_stylesheet.js",
  import.meta.url,
).href;

export const babelPluginNewStylesheetInjector = (
  babel,
  { babelHelpersAsImport, getImportSpecifier },
) => {
  return {
    name: "new-stylesheet-injector",
    visitor: {
      Program: (path, state) => {
        const { filename } = state;
        const fileUrl = pathToFileURL(filename).href;
        if (fileUrl === newStylesheetClientFileUrl) {
          return;
        }
        let newStyleSheetDetected = false;
        path.traverse({
          NewExpression: (path) => {
            if (isNewCssStyleSheetCall(path.node)) {
              newStyleSheetDetected = true;
              path.stop();
            }
          },
          MemberExpression: (path) => {
            if (isDocumentAdoptedStyleSheets(path.node)) {
              newStyleSheetDetected = true;
              path.stop();
            }
          },
          CallExpression: (path) => {
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
            if (
              hasCssModuleQueryParam(sourcePath) ||
              hasImportTypeCssAssertion(path)
            ) {
              newStyleSheetDetected = true;
              path.stop();
            }
          },
          ImportDeclaration: (path) => {
            const sourcePath = path.get("source");
            if (
              hasCssModuleQueryParam(sourcePath) ||
              hasImportTypeCssAssertion(path)
            ) {
              newStyleSheetDetected = true;
              path.stop();
            }
          },
          ExportAllDeclaration: (path) => {
            const sourcePath = path.get("source");
            if (hasCssModuleQueryParam(sourcePath)) {
              newStyleSheetDetected = true;
              path.stop();
            }
          },
          ExportNamedDeclaration: (path) => {
            if (!path.node.source) {
              // This export has no "source", so it's probably
              // a local variable or function, e.g.
              // export { varName }
              // export const constName = ...
              // export function funcName() {}
              return;
            }
            const sourcePath = path.get("source");
            if (hasCssModuleQueryParam(sourcePath)) {
              newStyleSheetDetected = true;
              path.stop();
            }
          },
        });
        state.file.metadata.newStyleSheetDetected = newStyleSheetDetected;
        if (newStyleSheetDetected) {
          const { sourceType } = state.file.opts.parserOpts;
          const isJsModule = sourceType === "module";
          injectPolyfillIntoBabelAst({
            programPath: path,
            isJsModule,
            asImport: babelHelpersAsImport,
            polyfillFileUrl: newStylesheetClientFileUrl,
            getPolyfillImportSpecifier: getImportSpecifier,
            babel,
          });
        }
      },
    },
  };
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

const hasCssModuleQueryParam = (path) => {
  const { node } = path;
  return (
    node.type === "StringLiteral" &&
    new URL(node.value, "https://jsenv.dev").searchParams.has(`css_module`)
  );
};

const hasImportTypeCssAssertion = (path) => {
  const importAssertionsDescriptor = getImportAssertionsDescriptor(
    path.node.assertions,
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
