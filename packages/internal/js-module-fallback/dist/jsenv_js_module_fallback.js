import { applyBabelPlugins, babelPluginAsyncToPromises } from "@jsenv/ast";
import { composeTwoSourcemaps } from "@jsenv/sourcemap";
import { urlToRelativeUrl } from "@jsenv/urls";
import { createRequire } from "node:module";
import { parseExpression } from "@babel/parser";

const babelPluginTransformImportMetaResolve = () => {
  return {
    name: "transform-import-meta-resolve",
    visitor: {
      Program: (programPath) => {
        programPath.traverse({
          MemberExpression: (path) => {
            const node = path.node;
            if (
              node.object.type === "MetaProperty" &&
              node.object.property.name === "meta" &&
              node.property.name === "resolve"
            ) {
              const firstArg = node.arguments[0];
              if (firstArg && firstArg.type === "StringLiteral") {
                path.replaceWithSourceString(
                  `new URL(${firstArg.value}, document.currentScript.src).href`,
                );
              }
            }
          },
        });
      },
    },
  };
};

const babelPluginTransformImportMetaUrl = (babel) => {
  return {
    name: "transform-import-meta-url",
    visitor: {
      Program: (programPath) => {
        const currentUrlIdentifier =
          programPath.scope.generateUidIdentifier("currentUrl");
        let used = false;

        programPath.traverse({
          MemberExpression: (path) => {
            const node = path.node;
            if (
              node.object.type === "MetaProperty" &&
              node.object.property.name === "meta" &&
              node.property.name === "url"
            ) {
              // const node = babel.types.valueToNode(10)
              const identifier = babel.types.identifier(
                currentUrlIdentifier.name,
              );
              const expressionStatement =
                babel.types.expressionStatement(identifier);
              path.replaceWith(expressionStatement);
              used = true;
            }
          },
        });
        if (used) {
          const ast = generateExpressionAst(`document.currentScript.src`);
          programPath.scope.push({
            id: currentUrlIdentifier,
            init: ast,
          });
        }
      },
    },
  };
};

const generateExpressionAst = (expression, options) => {
  const ast = parseExpression(expression, options);
  return ast;
};

const systemJsClientFileUrlDefault = import.meta
  .resolve("./client/s.js");

const require$1 = createRequire(import.meta.url);

const convertJsModuleToJsClassic = async ({
  input,
  inputSourcemap,
  inputUrl,
  outputUrl,
  generateSourcemap = true,
  outputFormat = "system", // "systemjs" or "umd"
  preferAbsoluteSpecifiers,
  remapImportSpecifier = (specifier) => specifier,
}) => {
  /*
   * When systemjs or umd format is used by babel, it will generated UID based on
   * the import specifier:
   * https://github.com/babel/babel/blob/97d1967826077f15e766778c0d64711399e9a72a/packages/babel-plugin-transform-modules-systemjs/src/index.ts#L498
   * But at this stage import specifier are absolute file urls
   * This can be mitigated by minification that will rename them.
   * But to fix this issue once and for all there is babelPluginRelativeImports below
   */
  const transformImportSpecifier = (specifier) => {
    specifier = remapImportSpecifier(specifier, inputUrl);
    if (!specifier.startsWith("file://")) {
      return null;
    }
    const specifierUrlObject = new URL(specifier);
    const { searchParams } = specifierUrlObject;
    searchParams.delete("dynamic_import");
    const specifierWithoutDynamicImportParam = specifierUrlObject.href;
    if (preferAbsoluteSpecifiers) {
      return specifierWithoutDynamicImportParam;
    }
    const specifierRelative = urlToRelativeUrl(specifier, outputUrl);
    if (specifierRelative.startsWith("file://")) {
      return specifierRelative;
    }
    if (specifierRelative[0] === ".") {
      return specifierRelative;
    }
    // ensure relative specifier starts with "." so they are not detected as bare specifier
    // that would trigger node module resolution or importmap
    return `./${specifierRelative}`;
  };

  const { code, map } = await applyBabelPlugins({
    babelPlugins: [
      ...(outputFormat === "system"
        ? [
            // transform-dynamic-import required with systemjs for babel8:
            // https://github.com/babel/babel/issues/10746
            require$1("@babel/plugin-transform-dynamic-import"),
            [
              babelPluginTransformImportSpecifiers,
              { transformImportSpecifier },
            ],
            require$1("@babel/plugin-transform-modules-systemjs"),
            [
              babelPluginAsyncToPromises,
              {
                asyncAwait: false, // already handled + we might not needs it at all
                topLevelAwait: "return",
              },
            ],
          ]
        : [
            [
              babelPluginAsyncToPromises,
              {
                asyncAwait: false, // already handled + we might not needs it at all
                topLevelAwait: "simple",
              },
            ],
            babelPluginTransformImportMetaUrl,
            babelPluginTransformImportMetaResolve,
            [
              babelPluginTransformImportSpecifiers,
              { transformImportSpecifier },
            ],
            require$1("@babel/plugin-transform-modules-umd"),
          ]),
    ],
    input,
    inputIsJsModule: true,
    inputUrl,
    outputUrl,
    options: { sourceMaps: generateSourcemap },
  });
  const sourcemap = composeTwoSourcemaps(inputSourcemap, map);
  return {
    content: code,
    sourcemap,
  };
};

const babelPluginTransformImportSpecifiers = (babel) => {
  const t = babel.types;

  const replaceSpecifierAtPath = (path, state) => {
    const specifier = path.node.value;
    const specifierTransformed = state.opts.transformImportSpecifier(specifier);
    if (specifierTransformed && specifierTransformed !== specifier) {
      path.replaceWith(t.stringLiteral(specifierTransformed));
    }
  };

  return {
    name: "transform-import-specifiers",
    visitor: {
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
        if (sourcePath.node.type === "StringLiteral") {
          replaceSpecifierAtPath(sourcePath, state);
        }
      },
      ImportDeclaration: (path, state) => {
        const sourcePath = path.get("source");
        replaceSpecifierAtPath(sourcePath, state);
      },
      ExportAllDeclaration: (path, state) => {
        const sourcePath = path.get("source");
        replaceSpecifierAtPath(sourcePath, state);
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
        if (sourcePath.node.type === "StringLiteral") {
          replaceSpecifierAtPath(sourcePath, state);
        }
      },
    },
  };
};

export { convertJsModuleToJsClassic, systemJsClientFileUrlDefault };
