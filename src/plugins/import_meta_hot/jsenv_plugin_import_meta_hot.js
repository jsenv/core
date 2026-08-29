import { parseHtml } from "@jsenv/ast";
import { createMagicSource } from "@jsenv/sourcemap";

import { collectHotDataFromHtmlAst } from "./html_hot_dependencies.js";
import { analyzeImportMetaHot } from "./import_meta_hot_analysis.js";

export const jsenvPluginImportMetaHot = () => {
  const importMetaHotClientFileUrl = import.meta
    .resolve("./client/import_meta_hot.js");

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
      js_module: (urlInfo) => {
        // Do not scan node modules for import.meta.hot
        // - unlikely to be there
        // - we don't watch node modules (too expensive)
        // They would be discarded by content.includes detection
        // but it's cheaper to detect by URL than to scan potentially large files
        if (urlInfo.url.includes("/node_modules/")) {
          return null;
        }
        if (!urlInfo.content.includes("import.meta.hot")) {
          return null;
        }
        const {
          importMetaHotNodes,
          hotDecline,
          hotAcceptSelf,
          hotAcceptSpecifiers,
        } = analyzeImportMetaHot(urlInfo.contentAst);
        urlInfo.data.hotDecline = hotDecline;
        urlInfo.data.hotAcceptSelf = hotAcceptSelf;
        urlInfo.data.hotAcceptDependencies = hotAcceptSpecifiers.map(
          (specifier) => resolveHotAcceptSpecifier(urlInfo, specifier),
        );
        if (importMetaHotNodes.length === 0) {
          return null;
        }
        if (urlInfo.context.build) {
          return removeImportMetaHots(urlInfo, importMetaHotNodes);
        }
        return injectImportMetaHot(urlInfo, importMetaHotClientFileUrl);
      },
    },
  };
};

// The specifier given to import.meta.hot.accept() is one the file imports,
// so its url is known from that import (autoreload compares urls). A
// specifier the file does not import accepts nothing: it is kept as a plain
// url, never resolved as a dependency (that could throw on a bare specifier).
const resolveHotAcceptSpecifier = (urlInfo, specifier) => {
  for (const referenceToOther of urlInfo.referenceToOthersSet) {
    if (
      referenceToOther.type === "js_import" &&
      referenceToOther.specifier === specifier
    ) {
      return referenceToOther.url;
    }
  }
  try {
    return new URL(specifier, urlInfo.url).href;
  } catch {
    return specifier;
  }
};

const removeImportMetaHots = (urlInfo, importMetaHotNodes) => {
  const magicSource = createMagicSource(urlInfo.content);
  importMetaHotNodes.forEach((node) => {
    magicSource.replace({
      start: node.start,
      end: node.end,
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
  let content = urlInfo.content;
  let prelude = `import { createImportMetaHot } from ${importMetaHotClientFileReference.generatedSpecifier};
import.meta.hot = createImportMetaHot(import.meta.url);
`;
  return {
    content: `${prelude.replace(/\n/g, "")}${content}`,
  };
};
