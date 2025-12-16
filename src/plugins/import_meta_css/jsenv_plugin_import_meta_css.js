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
  const importMetaCssClientFileUrl = import.meta
    .resolve("./client/import_meta_css.js");
  const importMetaCssBuildFileUrl = import.meta
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
        return injectImportMetaCss(
          urlInfo,
          urlInfo.context.build
            ? importMetaCssBuildFileUrl
            : importMetaCssClientFileUrl,
        );
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

const injectImportMetaCss = (urlInfo, importMetaCssClientFileUrl) => {
  const importMetaCssClientFileReference = urlInfo.dependencies.inject({
    parentUrl: urlInfo.url,
    type: "js_import",
    expectedType: "js_module",
    specifier: importMetaCssClientFileUrl,
  });
  let content = urlInfo.content;
  let prelude = `import { installImportMetaCss } from ${importMetaCssClientFileReference.generatedSpecifier};

const remove = installImportMetaCss(import.meta);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    remove();
  });
}

`;
  return {
    content: `${prelude.replace(/\n/g, "")}${content}`,
  };
};
