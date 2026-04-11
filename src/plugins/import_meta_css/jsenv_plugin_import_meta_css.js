/**
 * Inline CSS would force to write the following boilerplate all the time:
 * ```js
 * const css = `body { color: red; }`;
 * const stylesheet = new CSSStyleSheet();
 * stylesheet.replaceSync(css);
 * document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
 * if (import.meta.hot) {
 *   import.meta.hot.dispose(() => {
 *       document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
 *           (s) => s !== stylesheet,
 *       );
 *   });
 * }
 * ```
 *
 * It would be nice to have a plugin that does this automatically with the following syntax
 *
 * ```js
 * const css = `body { color: red; }`;
 * import.meta.css = css;
 * ```
 *
 */

import { applyBabelPlugins } from "@jsenv/ast";

export const jsenvPluginImportMetaCss = () => {
  const importMetaCssDevClientFileUrl = import.meta
    .resolve("./client/import_meta_css_dev.js");
  const importMetaCssBuildClientFileUrl = import.meta
    .resolve("./client/import_meta_css_build.js");

  return {
    name: "jsenv:import_meta_css",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo) => {
        if (!urlInfo.content.includes("import.meta.css")) {
          return null;
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataUsesImportMetaCss],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        const { usesImportMetaCss } = metadata;
        if (!usesImportMetaCss) {
          return null;
        }
        if (urlInfo.context.build) {
          const rootDirectoryUrl = urlInfo.context.rootDirectoryUrl;
          const relativeUrl = urlInfo.originalUrl.slice(
            rootDirectoryUrl.length - 1,
          );
          const { code } = await applyBabelPlugins({
            babelPlugins: [
              [babelPluginRewriteImportMetaCssAssignment, { relativeUrl }],
            ],
            input: urlInfo.content,
            inputIsJsModule: true,
            inputUrl: urlInfo.originalUrl,
            outputUrl: urlInfo.generatedUrl,
          });
          return injectImportMetaCss(urlInfo, {
            content: code,
            importFrom: importMetaCssBuildClientFileUrl,
            importName: "installImportMetaCssBuild",
            importAs: "__installImportMetaCssBuild__",
          });
        }
        return injectImportMetaCss(urlInfo, {
          content: urlInfo.content,
          importFrom: importMetaCssDevClientFileUrl,
          importName: "installImportMetaCssDev",
          importAs: "__installImportMetaCssDev__",
          hot: true,
        });
      },
    },
  };
};

const babelPluginRewriteImportMetaCssAssignment = (
  { types: t },
  { relativeUrl },
) => {
  return {
    name: "rewrite-import-meta-css-assignment",
    visitor: {
      AssignmentExpression(path) {
        const { left, right } = path.node;
        if (left.type !== "MemberExpression") {
          return;
        }
        const { object, property } = left;
        if (object.type !== "MetaProperty") {
          return;
        }
        if (object.meta.name !== "import" || object.property.name !== "meta") {
          return;
        }
        if (property.name !== "css") {
          return;
        }
        path.node.right = t.arrayExpression([
          right,
          t.stringLiteral(relativeUrl),
        ]);
      },
    },
  };
};

const babelPluginMetadataUsesImportMetaCss = () => {
  return {
    name: "metadata-uses-import-meta-css",
    visitor: {
      Program(programPath, state) {
        let usesImportMetaCss = false;
        programPath.traverse({
          MemberExpression(path) {
            const { node } = path;
            const { object } = node;
            if (object.type !== "MetaProperty") {
              return;
            }
            const { property: objectProperty } = object;
            if (objectProperty.name !== "meta") {
              return;
            }
            const { property } = node;
            const { name } = property;
            if (name === "css") {
              usesImportMetaCss = true;
              path.stop();
            }
          },
        });
        state.file.metadata.usesImportMetaCss = usesImportMetaCss;
      },
    },
  };
};

const injectImportMetaCss = (
  urlInfo,
  { content, importFrom, importName, importAs, hot },
) => {
  const importMetaCssClientFileReference = urlInfo.dependencies.inject({
    parentUrl: urlInfo.url,
    type: "js_import",
    expectedType: "js_module",
    specifier: importFrom,
  });
  let importVariableName;
  let importBeforeFrom;
  if (importAs && importAs !== importName) {
    importBeforeFrom = `{ ${importName} as ${importAs} }`;
    importVariableName = importAs;
  } else {
    importBeforeFrom = `{ ${importName} } }`;
    importVariableName = importName;
  }

  const prelude = hot
    ? `import ${importBeforeFrom} from ${importMetaCssClientFileReference.generatedSpecifier};

const remove = ${importVariableName}(import.meta);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    remove();
  });
}

`
    : `import ${importBeforeFrom} from ${importMetaCssClientFileReference.generatedSpecifier};

${importVariableName}(import.meta);

`;

  return {
    content: `${prelude.replace(/\n/g, "")}${content}`,
  };
};
