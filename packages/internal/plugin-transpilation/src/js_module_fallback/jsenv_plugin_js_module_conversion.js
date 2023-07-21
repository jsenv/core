/*
 * - propagate "?js_module_fallback" query string param on urls
 * - perform conversion from js module to js classic when url uses "?js_module_fallback"
 */

import { urlToFilename, injectQueryParams } from "@jsenv/urls";
import {
  convertJsModuleToJsClassic,
  systemJsClientFileUrlDefault,
} from "@jsenv/js-module-fallback";

export const jsenvPluginJsModuleConversion = () => {
  const isReferencingJsModule = (reference) => {
    if (
      reference.type === "js_import" ||
      reference.subtype === "system_register_arg" ||
      reference.subtype === "system_import_arg"
    ) {
      return true;
    }
    if (reference.type === "js_url" && reference.expectedType === "js_module") {
      return true;
    }
    return false;
  };

  const shouldPropagateJsModuleConversion = (reference) => {
    if (isReferencingJsModule(reference)) {
      const insideJsClassic =
        reference.ownerUrlInfo.searchParams.has("js_module_fallback");
      return insideJsClassic;
    }
    return false;
  };

  const markAsJsClassicProxy = (reference) => {
    reference.volatileSearchParamSet.add("js_module_fallback");
    reference.expectedType = "js_classic";
    if (!reference.filename) {
      reference.filename = generateJsClassicFilename(reference.url);
    }
  };

  const turnIntoJsClassicProxy = (reference) => {
    markAsJsClassicProxy(reference);
    return injectQueryParams(reference.url, {
      js_module_fallback: "",
    });
  };

  return {
    name: "jsenv:js_module_conversion",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.searchParams.has("js_module_fallback")) {
        markAsJsClassicProxy(reference);
        return null;
      }
      // We want to propagate transformation of js module to js classic to:
      // - import specifier (static/dynamic import + re-export)
      // - url specifier when inside System.register/_context.import()
      //   (because it's the transpiled equivalent of static and dynamic imports)
      // And not other references otherwise we could try to transform inline resources
      // or specifiers inside new URL()...
      if (shouldPropagateJsModuleConversion(reference)) {
        return turnIntoJsClassicProxy(reference);
      }
      return null;
    },
    fetchUrlContent: async (urlInfo) => {
      const jsModuleUrlInfo = urlInfo.getWithoutSearchParam(
        "js_module_fallback",
        {
          // override the expectedType to "js_module"
          // because when there is ?js_module_fallback it means the underlying resource
          // is a js_module
          expectedType: "js_module",
        },
      );
      if (!jsModuleUrlInfo) {
        return null;
      }
      await jsModuleUrlInfo.cook();
      let outputFormat;
      if (urlInfo.isEntryPoint && !jsModuleUrlInfo.data.usesImport) {
        // if it's an entry point without dependency (it does not use import)
        // then we can use UMD
        outputFormat = "umd";
      } else {
        // otherwise we have to use system in case it's imported
        // by an other file (for entry points)
        // or to be able to import when it uses import
        outputFormat = "system";
        urlInfo.type = "js_classic";
        urlInfo.dependencies.foundSideEffectFile({
          sideEffectFileUrl: systemJsClientFileUrlDefault,
          expectedType: "js_classic",
          line: 0,
          column: 0,
        });
      }
      const { content, sourcemap } = await convertJsModuleToJsClassic({
        rootDirectoryUrl: urlInfo.context.rootDirectoryUrl,
        input: jsModuleUrlInfo.content,
        inputIsEntryPoint: urlInfo.isEntryPoint,
        inputSourcemap: jsModuleUrlInfo.sourcemap,
        inputUrl: jsModuleUrlInfo.url,
        outputUrl: urlInfo.url,
        outputFormat,
        // during build we preserve absolute urls leading to build directory
        preferAbsoluteSpecifiers: urlInfo.context.build,
      });
      return {
        content,
        contentType: "text/javascript",
        type: "js_classic",
        originalUrl: jsModuleUrlInfo.originalUrl,
        originalContent: jsModuleUrlInfo.originalContent,
        sourcemap,
        data: jsModuleUrlInfo.data,
      };
    },
  };
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
