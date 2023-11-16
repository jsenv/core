import { createMagicSource } from "@jsenv/sourcemap";
import { parseHtml, applyBabelPlugins } from "@jsenv/ast";

import { collectHotDataFromHtmlAst } from "./html_hot_dependencies.js";
import { babelPluginMetadataImportMetaHot } from "./babel_plugin_metadata_import_meta_hot.js";

export const jsenvPluginImportMetaHot = () => {
  const importMetaHotClientFileUrl = new URL(
    "./client/import_meta_hot.js",
    import.meta.url,
  ).href;

  return {
    name: "jsenv:import_meta_hot",
    appliesDuring: "*",
    transformUrlContent: {
      html: (htmlUrlInfo) => {
        // during build we don't really care to parse html hot dependencies
        if (htmlUrlInfo.context.build) {
          return;
        }
        const htmlAst = parseHtml({
          html: htmlUrlInfo.content,
          url: htmlUrlInfo.url,
        });
        const hotReferences = collectHotDataFromHtmlAst(htmlAst);
        htmlUrlInfo.data.hotDecline = false;
        htmlUrlInfo.data.hotAcceptSelf = false;
        htmlUrlInfo.data.hotAcceptDependencies = hotReferences.map(
          ({ type, specifier }) => {
            let existingReference = null;
            for (const referenceToOther of htmlUrlInfo.referenceToOthersSet) {
              if (
                referenceToOther.type === type &&
                referenceToOther.specifier === specifier
              ) {
                existingReference = referenceToOther;
                break;
              }
            }
            if (existingReference) {
              return existingReference.url;
            }
            const reference = htmlUrlInfo.dependencies.found({
              type,
              specifier,
            });
            return reference.url;
          },
        );
      },
      css: (cssUrlInfo) => {
        cssUrlInfo.data.hotDecline = false;
        cssUrlInfo.data.hotAcceptSelf = false;
        cssUrlInfo.data.hotAcceptDependencies = [];
      },
      js_module: async (urlInfo) => {
        if (!urlInfo.content.includes("import.meta.hot")) {
          return null;
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaHot],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        const {
          importMetaHotPaths,
          hotDecline,
          hotAcceptSelf,
          hotAcceptDependencies,
        } = metadata;
        urlInfo.data.hotDecline = hotDecline;
        urlInfo.data.hotAcceptSelf = hotAcceptSelf;
        urlInfo.data.hotAcceptDependencies = hotAcceptDependencies;
        if (importMetaHotPaths.length === 0) {
          return null;
        }
        if (urlInfo.context.build) {
          return removeImportMetaHots(urlInfo, importMetaHotPaths);
        }
        return injectImportMetaHot(urlInfo, importMetaHotClientFileUrl);
      },
    },
  };
};

const removeImportMetaHots = (urlInfo, importMetaHotPaths) => {
  const magicSource = createMagicSource(urlInfo.content);
  importMetaHotPaths.forEach((path) => {
    magicSource.replace({
      start: path.node.start,
      end: path.node.end,
      replacement: "undefined",
    });
  });
  return magicSource.toContentAndSourcemap();
};

// For some reason using magic source here produce
// better sourcemap than doing the equivalent with babel
// I suspect it's because I was doing injectAstAfterImport(programPath, ast.program.body[0])
// which is likely not well supported by babel
const injectImportMetaHot = (urlInfo, importMetaHotClientFileUrl) => {
  const importMetaHotClientFileReference = urlInfo.dependencies.inject({
    parentUrl: urlInfo.url,
    type: "js_import",
    expectedType: "js_module",
    specifier: importMetaHotClientFileUrl,
  });
  const magicSource = createMagicSource(urlInfo.content);
  magicSource.prepend(
    `import { createImportMetaHot } from ${importMetaHotClientFileReference.generatedSpecifier};
import.meta.hot = createImportMetaHot(import.meta.url);
`,
  );
  return magicSource.toContentAndSourcemap();
};
