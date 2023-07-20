import { createRequire } from "node:module";
import { urlToRelativeUrl } from "@jsenv/urls";
import { composeTwoSourcemaps } from "@jsenv/sourcemap";
import { applyBabelPlugins } from "@jsenv/ast";

import { babelPluginTransformImportMetaUrl } from "./internal/babel_plugin_transform_import_meta_url.js";
import { babelPluginTransformImportMetaResolve } from "./internal/babel_plugin_transform_import_meta_resolve.js";
// because of https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/84
import customAsyncToPromises from "./internal/async-to-promises.js";

export const systemJsClientFileUrlDefault = new URL(
  "./client/s.js",
  import.meta.url,
).href;

const require = createRequire(import.meta.url);

export const convertJsModuleToJsClassic = async ({
  input,
  inputSourcemap,
  inputUrl,
  outputUrl,
  outputFormat = "system", // "systemjs" or "umd"
  preferAbsoluteSpecifiers,
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
            // proposal-dynamic-import required with systemjs for babel8:
            // https://github.com/babel/babel/issues/10746
            require("@babel/plugin-proposal-dynamic-import"),
            [
              babelPluginTransformImportSpecifiers,
              { transformImportSpecifier },
            ],
            require("@babel/plugin-transform-modules-systemjs"),
            [
              customAsyncToPromises,
              {
                asyncAwait: false, // already handled + we might not needs it at all
                topLevelAwait: "return",
              },
            ],
          ]
        : [
            [
              require("babel-plugin-transform-async-to-promises"),
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
            require("@babel/plugin-transform-modules-umd"),
          ]),
    ],
    input,
    inputIsJsModule: true,
    inputUrl,
    outputUrl,
  });
  const sourcemap = await composeTwoSourcemaps(inputSourcemap, map);
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
