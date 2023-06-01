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
      Program: {
        enter: (path, state) => {
          state.file.metadata.newStyleSheetDetected = false;
          const { filename } = state;
          const fileUrl = pathToFileURL(filename).href;
          if (fileUrl === newStylesheetClientFileUrl) {
            path.stop();
          }
        },
        exit: (path, state) => {
          if (!state.file.metadata.newStyleSheetDetected) return;
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
        },
      },
      NewExpression: (path, state) => {
        state.file.metadata.newStyleSheetDetected = isNewCssStyleSheetCall(
          path.node,
        );
        if (state.file.metadata.newStyleSheetDetected) {
          state.file.metadata.newStyleSheetDetected = true;
          path.stop();
        }
      },
      MemberExpression: (path, state) => {
        state.file.metadata.newStyleSheetDetected =
          isDocumentAdoptedStyleSheets(path.node);
        if (state.file.metadata.newStyleSheetDetected) {
          path.stop();
        }
      },
      CallExpression: (path, state) => {
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
        state.file.metadata.newStyleSheetDetected =
          hasCssModuleQueryParam(sourcePath) || hasImportTypeCssAssertion(path);
        if (state.file.metadata.newStyleSheetDetected) {
          path.stop();
        }
      },
      ImportDeclaration: (path, state) => {
        const sourcePath = path.get("source");
        state.file.metadata.newStyleSheetDetected =
          hasCssModuleQueryParam(sourcePath) || hasImportTypeCssAssertion(path);
        if (state.file.metadata.newStyleSheetDetected) {
          path.stop();
        }
      },
      ExportAllDeclaration: (path, state) => {
        const sourcePath = path.get("source");
        state.file.metadata.newStyleSheetDetected =
          hasCssModuleQueryParam(sourcePath);
        if (state.file.metadata.newStyleSheetDetected) {
          path.stop();
        }
      },
      ExportNamedDeclaration: (path, state) => {
        if (!path.node.source) {
          // This export has no "source", so it's probably
          // a local variable or function, e.g.
          // export { varName }
          // export const constName = ...
          // export function funcName() {}
          return;
        }
        const sourcePath = path.get("source");
        state.file.metadata.newStyleSheetDetected =
          hasCssModuleQueryParam(sourcePath);
        if (state.file.metadata.newStyleSheetDetected) {
          path.stop();
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
