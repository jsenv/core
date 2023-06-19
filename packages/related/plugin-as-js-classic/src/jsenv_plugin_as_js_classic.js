import { urlToFilename } from "@jsenv/urls";
import {
  convertJsModuleToJsClassic,
  systemJsClientFileUrlDefault,
} from "@jsenv/js-module-fallback";
import { bundleJsModules } from "@jsenv/plugin-bundling";

export const jsenvPluginAsJsClassic = () => {
  const markAsJsClassicProxy = (reference) => {
    reference.expectedType = "js_classic";
    reference.filename = generateJsClassicFilename(reference.url);
  };

  return {
    name: "jsenv:as_js_classic",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.searchParams.has("as_js_classic")) {
        markAsJsClassicProxy(reference);
      }
    },
    fetchUrlContent: async (urlInfo, context) => {
      const [jsModuleReference, jsModuleUrlInfo] =
        urlInfo.reference.getWithoutSearchParam({
          searchParam: "as_js_classic",
          // override the expectedType to "js_module"
          // because when there is ?as_js_classic it means the underlying resource
          // is a js_module
          expectedType: "js_module",
        });
      if (!jsModuleReference) {
        return null;
      }
      // cook it to get content + dependencies
      await jsModuleUrlInfo.cook();
      await jsModuleUrlInfo.cookReferences({
        // we ignore dynamic import to cook lazyly (as browser request the server)
        // these dynamic imports must inherit "?as_js_classic"
        // This is done inside rollup for convenience
        ignoreDynamicImport: true,
      });
      const bundleUrlInfos = await bundleJsModules({
        jsModuleUrlInfos: [jsModuleUrlInfo],
        context: {
          ...context,
          buildDirectoryUrl: new URL("./", import.meta.url),
        },
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
      if (
        jsModuleBundledUrlInfo.data.usesImport ||
        isImportedByJs(urlInfo, context.urlGraph)
      ) {
        // we have to use system when it uses import
        outputFormat = "system";
        urlInfo.type = "js_classic";
        urlInfo.references.foundSideEffectFile({
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

      if (context.dev) {
        jsModuleBundledUrlInfo.sourceUrls.forEach((sourceUrl) => {
          urlInfo.references.inject({
            type: "js_url",
            specifier: sourceUrl,
            isImplicit: true,
          });
        });
      } else if (context.build) {
        jsModuleBundledUrlInfo.sourceUrls.forEach((sourceUrl) => {
          const sourceUrlInfo = urlInfo.graph.getUrlInfo(sourceUrl);
          if (sourceUrlInfo && !sourceUrlInfo.hasDependent()) {
            sourceUrlInfo.deleteFromGraph();
          }
        });
      }

      const { content, sourcemap } = await convertJsModuleToJsClassic({
        rootDirectoryUrl: context.rootDirectoryUrl,
        input: jsModuleBundledUrlInfo.content,
        inputSourcemap: jsModuleBundledUrlInfo.sourcemap,
        inputUrl: jsModuleBundledUrlInfo.url,
        outputUrl: jsModuleBundledUrlInfo.generatedUrl,
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

const isImportedByJs = (jsModuleUrlInfo, urlGraph) => {
  for (const dependentUrl of jsModuleUrlInfo.dependents) {
    const dependentUrlInfo = urlGraph.getUrlInfo(dependentUrl);
    if (
      dependentUrlInfo.type === "js_module" ||
      dependentUrlInfo.type === "js_classic"
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
