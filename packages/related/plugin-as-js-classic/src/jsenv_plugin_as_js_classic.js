import { urlToFilename } from "@jsenv/urls";
import {
  convertJsModuleToJsClassic,
  systemJsClientFileUrlDefault,
} from "@jsenv/js-module-fallback";
import { bundleJsModules } from "@jsenv/plugin-bundling";

export const jsenvPluginAsJsClassic = () => {
  const markAsJsClassicProxy = (reference) => {
    reference.expectedType = "js_classic";
    if (!reference.filename) {
      reference.filename = generateJsClassicFilename(reference.url);
    }
  };

  return {
    name: "jsenv:as_js_classic",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.searchParams.has("as_js_classic")) {
        markAsJsClassicProxy(reference);
      }
    },
    fetchUrlContent: async (urlInfo) => {
      const jsModuleUrlInfo = urlInfo.getWithoutSearchParam("as_js_classic", {
        // override the expectedType to "js_module"
        // because when there is ?as_js_classic it means the underlying resource
        // is a js_module
        expectedType: "js_module",
      });
      if (!jsModuleUrlInfo) {
        return null;
      }
      // cook it to get content + dependencies
      await jsModuleUrlInfo.cook();
      await jsModuleUrlInfo.cookDependencies({
        // we ignore dynamic import to cook lazyly (as browser request the server)
        // these dynamic imports must inherit "?as_js_classic"
        // This is done inside rollup for convenience
        ignoreDynamicImport: true,
      });
      const bundleUrlInfos = await bundleJsModules([jsModuleUrlInfo], {
        buildDirectoryUrl: new URL("./", import.meta.url),
        preserveDynamicImport: true,
        augmentDynamicImportUrlSearchParams: () => {
          return {
            as_js_classic: "",
            dynamic_import: "",
          };
        },
      });
      const jsModuleBundledUrlInfo = bundleUrlInfos[jsModuleUrlInfo.url];

      let outputFormat;
      // if imported by js, we have to use systemjs
      // or if import things
      if (jsModuleBundledUrlInfo.data.usesImport || isImportedByJs(urlInfo)) {
        // we have to use system when it uses import
        outputFormat = "system";
        urlInfo.type = "js_classic";
        urlInfo.dependencies.foundSideEffectFile({
          sideEffectFileUrl: systemJsClientFileUrlDefault,
          expectedType: "js_classic",
          line: 0,
          column: 0,
        });
      } else {
        // if there is no dependency (it does not use import)
        // then we can use UMD
        outputFormat = "umd";
      }

      if (urlInfo.context.dev) {
        jsModuleBundledUrlInfo.sourceUrls.forEach((sourceUrl) => {
          urlInfo.dependencies.inject({
            isImplicit: true,
            type: "js_url",
            specifier: sourceUrl,
          });
        });
      } else if (urlInfo.context.build) {
        jsModuleUrlInfo.firstReference.remove();
        jsModuleBundledUrlInfo.sourceUrls.forEach((sourceUrl) => {
          const sourceUrlInfo = urlInfo.graph.getUrlInfo(sourceUrl);
          if (
            sourceUrlInfo &&
            !sourceUrlInfo.getFirstReferenceFromOther({ ignoreWeak: true })
          ) {
            sourceUrlInfo.deleteFromGraph();
          }
        });
      }

      const { content, sourcemap } = await convertJsModuleToJsClassic({
        rootDirectoryUrl: urlInfo.context.rootDirectoryUrl,
        input: jsModuleBundledUrlInfo.content,
        inputSourcemap: jsModuleBundledUrlInfo.sourcemap,
        inputUrl: urlInfo.url,
        outputUrl: jsModuleBundledUrlInfo.url,
        outputFormat,
      });
      return {
        content,
        contentType: "text/javascript",
        type: "js_classic",
        originalUrl: urlInfo.originalUrl,
        originalContent: jsModuleUrlInfo.originalContent,
        sourcemap,
        data: jsModuleUrlInfo.data,
      };
    },
  };
};

const isImportedByJs = (jsModuleUrlInfo) => {
  for (const referenceFromOther of jsModuleUrlInfo.referenceFromOthersSet) {
    const urlInfoReferencingJsModule = referenceFromOther.ownerUrlInfo;
    if (
      urlInfoReferencingJsModule.type === "js_module" ||
      urlInfoReferencingJsModule.type === "js_classic"
    ) {
      return true;
    }
  }
  return false;
};

const generateJsClassicFilename = (url) => {
  const filename = urlToFilename(url);
  let [basename, extension] = splitFileExtension(filename);
  const { searchParams } = new URL(url);
  if (
    searchParams.has("as_json_module") ||
    searchParams.has("as_css_module") ||
    searchParams.has("as_text_module")
  ) {
    extension = ".js";
  }
  return `${basename}.nomodule${extension}`;
};

const splitFileExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};
