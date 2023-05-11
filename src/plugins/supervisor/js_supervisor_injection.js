/*
 * ```js
 * console.log(42)
 * ```
 * becomes
 * ```js
 * window.__supervisor__.jsClassicStart('main.html@L10-L13.js')
 * try {
 *   console.log(42)
 *   window.__supervisor__.jsClassicEnd('main.html@L10-L13.js')
 * } catch(e) {
 *   window.__supervisor__.jsClassicError('main.html@L10-L13.js', e)
 * }
 * ```
 *
 * ```js
 * import value from "./file.js"
 * console.log(value)
 * ```
 * becomes
 * ```js
 * window.__supervisor__.jsModuleStart('main.html@L10-L13.js')
 * try {
 *   const value = await import("./file.js")
 *   console.log(value)
 *   window.__supervisor__.jsModuleEnd('main.html@L10-L13.js')
 * } catch(e) {
 *   window.__supervisor__.jsModuleError('main.html@L10-L13.js', e)
 * }
 * ```
 *
 * -> TO KEEP IN MIND:
 * Static import can throw errors like
 * The requested module '/js_module_export_not_found/foo.js' does not provide an export named 'answerr'
 * While dynamic import will work just fine
 * and create a variable named "undefined"
 */

import { urlToRelativeUrl } from "@jsenv/urls";
import { applyBabelPlugins } from "@jsenv/ast";
import { SOURCEMAP, generateSourcemapDataUrl } from "@jsenv/sourcemap";

export const injectSupervisorIntoJs = async ({
  webServer,
  content,
  url,
  type,
  inlineSrc,
}) => {
  const babelPluginJsSupervisor =
    type === "js_module"
      ? babelPluginJsModuleSupervisor
      : babelPluginJsClassicSupervisor;
  const result = await applyBabelPlugins({
    urlInfo: {
      content,
      originalUrl: url,
      type,
    },
    babelPlugins: [[babelPluginJsSupervisor, { inlineSrc }]],
  });
  let code = result.code;
  let map = result.map;
  const sourcemapDataUrl = generateSourcemapDataUrl(map);
  code = SOURCEMAP.writeComment({
    contentType: "text/javascript",
    content: code,
    specifier: sourcemapDataUrl,
  });
  code = `${code}
//# sourceURL=${urlToRelativeUrl(url, webServer.rootDirectoryUrl)}`;
  return code;
};

const babelPluginJsModuleSupervisor = (babel) => {
  const t = babel.types;

  return {
    name: "js-module-supervisor",
    visitor: {
      Program: (programPath, state) => {
        const { inlineSrc } = state.opts;
        if (state.file.metadata.jsExecutionInstrumented) return;
        state.file.metadata.jsExecutionInstrumented = true;

        const urlNode = t.stringLiteral(inlineSrc);
        const startCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleStart",
        });
        const endCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleEnd",
        });
        const errorCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleError",
          args: [t.identifier("e")],
        });

        const bodyPath = programPath.get("body");
        const importNodes = [];
        const topLevelNodes = [];
        for (const topLevelNodePath of bodyPath) {
          const topLevelNode = topLevelNodePath.node;
          if (t.isImportDeclaration(topLevelNode)) {
            importNodes.push(topLevelNode);
          } else {
            topLevelNodes.push(topLevelNode);
          }
        }

        // replace all import nodes with dynamic imports
        const dynamicImports = [];
        importNodes.forEach((importNode) => {
          const dynamicImportConversion = convertStaticImportIntoDynamicImport(
            importNode,
            t,
          );
          if (Array.isArray(dynamicImportConversion)) {
            dynamicImports.push(...dynamicImportConversion);
          } else {
            dynamicImports.push(dynamicImportConversion);
          }
        });

        const tryCatchNode = t.tryStatement(
          t.blockStatement([...dynamicImports, ...topLevelNodes, endCallNode]),
          t.catchClause(t.identifier("e"), t.blockStatement([errorCallNode])),
        );
        programPath.replaceWith(t.program([startCallNode, tryCatchNode]));
      },
    },
  };
};

const convertStaticImportIntoDynamicImport = (staticImportNode, t) => {
  const awaitExpression = t.awaitExpression(
    t.callExpression(t.import(), [
      t.stringLiteral(staticImportNode.source.value),
    ]),
  );

  // import "./file.js" -> await import("./file.js")
  if (staticImportNode.specifiers.length === 0) {
    return t.expressionStatement(awaitExpression);
  }
  if (staticImportNode.specifiers.length === 1) {
    const [firstSpecifier] = staticImportNode.specifiers;
    if (firstSpecifier.type === "ImportNamespaceSpecifier") {
      return t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier(firstSpecifier.local.name),
          awaitExpression,
        ),
      ]);
    }
  }
  if (staticImportNode.specifiers.length === 2) {
    const [first, second] = staticImportNode.specifiers;
    if (
      first.type === "ImportDefaultSpecifier" &&
      second.type === "ImportNamespaceSpecifier"
    ) {
      const namespaceDeclaration = t.variableDeclaration("const", [
        t.variableDeclarator(t.identifier(second.local.name), awaitExpression),
      ]);
      const defaultDeclaration = t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier(first.local.name),
          t.memberExpression(
            t.identifier(second.local.name),
            t.identifier("default"),
          ),
        ),
      ]);
      return [namespaceDeclaration, defaultDeclaration];
    }
  }

  // import { name } from "./file.js" -> const { name } = await import("./file.js")
  // import toto, { name } from "./file.js" -> const { name, default as toto } = await import("./file.js")
  const objectPattern = t.objectPattern(
    staticImportNode.specifiers.map((specifier) => {
      if (specifier.type === "ImportDefaultSpecifier") {
        return t.objectProperty(
          t.identifier("default"),
          t.identifier(specifier.local.name),
          false, // computed
          false, // shorthand
        );
      }
      // if (specifier.type === "ImportNamespaceSpecifier") {
      //   return t.restElement(t.identifier(specifier.local.name))
      // }
      const isRenamed = specifier.imported.name !== specifier.local.name;
      if (isRenamed) {
        return t.objectProperty(
          t.identifier(specifier.imported.name),
          t.identifier(specifier.local.name),
          false, // computed
          false, // shorthand
        );
      }
      // shorthand must be true
      return t.objectProperty(
        t.identifier(specifier.local.name),
        t.identifier(specifier.local.name),
        false, // computed
        true, // shorthand
      );
    }),
  );
  const variableDeclarator = t.variableDeclarator(
    objectPattern,
    awaitExpression,
  );
  const variableDeclaration = t.variableDeclaration("const", [
    variableDeclarator,
  ]);
  return variableDeclaration;
};

const babelPluginJsClassicSupervisor = (babel) => {
  const t = babel.types;

  return {
    name: "js-classic-supervisor",
    visitor: {
      Program: (programPath, state) => {
        const { inlineSrc } = state.opts;
        if (state.file.metadata.jsExecutionInstrumented) return;
        state.file.metadata.jsExecutionInstrumented = true;

        const urlNode = t.stringLiteral(inlineSrc);
        const startCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicStart",
        });
        const endCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicEnd",
        });
        const errorCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicError",
          args: [t.identifier("e")],
        });

        const topLevelNodes = programPath.node.body;
        const tryCatchNode = t.tryStatement(
          t.blockStatement([...topLevelNodes, endCallNode]),
          t.catchClause(t.identifier("e"), t.blockStatement([errorCallNode])),
        );

        programPath.replaceWith(t.program([startCallNode, tryCatchNode]));
      },
    },
  };
};

const createSupervisionCall = ({ t, methodName, urlNode, args = [] }) => {
  return t.expressionStatement(
    t.callExpression(
      t.memberExpression(
        t.memberExpression(
          t.identifier("window"),
          t.identifier("__supervisor__"),
        ),
        t.identifier(methodName),
      ),
      [urlNode, ...args],
    ),
    [],
    null,
  );
};
