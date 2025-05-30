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
import { babelPluginMetadataImportMetaCss } from "./babel_plugin_metadata_import_meta_css.js";

export const jsenvPluginImportMetaCss = () => {
  return {
    name: "jsenv:import_meta_css",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo) => {
        if (!urlInfo.content.includes("import.meta.css")) {
          return null;
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaCss],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        const { importMetaCssPaths } = metadata;
        urlInfo.data.importMetaCssPaths = importMetaCssPaths;
        if (importMetaCssPaths.length === 0) {
          return null;
        }
        return injectImportMetaCss(urlInfo, { isDev: urlInfo.context.dev });
      },
    },
  };
};

const injectImportMetaCss = (urlInfo, importMetaHotClientFileUrl) => {
  const importMetaCssClientFileReference = urlInfo.dependencies.inject({
    parentUrl: urlInfo.url,
    type: "js_import",
    expectedType: "js_module",
    specifier: importMetaHotClientFileUrl,
  });
  let content = urlInfo.content;
  let prelude = `import ${importMetaCssClientFileReference.generatedSpecifier};
`;
  return {
    content: `${prelude.replace(/\n/g, "")}${content}`,
  };
};
