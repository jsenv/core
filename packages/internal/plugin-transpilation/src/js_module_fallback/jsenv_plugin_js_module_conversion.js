/*
 * - propagate "?js_module_fallback" query string param on urls
 * - perform conversion from js module to js classic when url uses "?js_module_fallback"
 */

import { injectQueryParams } from "@jsenv/urls";
import {
  convertJsModuleToJsClassic,
  systemJsClientFileUrlDefault,
} from "@jsenv/js-module-fallback";

export const jsenvPluginJsModuleConversion = ({
  generateJsClassicFilename,
}) => {
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

  const shouldPropagateJsModuleConversion = (reference, context) => {
    if (isReferencingJsModule(reference, context)) {
      const insideJsClassic = new URL(reference.urlInfo.url).searchParams.has(
        "js_module_fallback",
      );
      return insideJsClassic;
    }
    return false;
  };

  const markAsJsClassicProxy = (reference) => {
    reference.expectedType = "js_classic";
    reference.filename = generateJsClassicFilename(reference.url);
  };

  const turnIntoJsClassicProxy = (reference) => {
    const urlTransformed = injectQueryParams(reference.url, {
      js_module_fallback: "",
    });
    markAsJsClassicProxy(reference);
    return urlTransformed;
  };

  return {
    name: "jsenv:js_module_conversion",
    appliesDuring: "*",
    redirectReference: (reference, context) => {
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
      if (shouldPropagateJsModuleConversion(reference, context)) {
        return turnIntoJsClassicProxy(reference, context);
      }
      return null;
    },
    fetchUrlContent: async (urlInfo, context) => {
      const [jsModuleReference, jsModuleUrlInfo] =
        context.reference.getWithoutSearchParam({
          searchParam: "js_module_fallback",
          // override the expectedType to "js_module"
          // because when there is ?js_module_fallback it means the underlying resource
          // is a js_module
          expectedType: "js_module",
        });
      if (!jsModuleReference) {
        return null;
      }
      await context.fetchUrlContent(jsModuleUrlInfo, {
        reference: jsModuleReference,
      });
      if (context.dev) {
        context.referenceUtils.found({
          type: "js_import",
          subtype: jsModuleReference.subtype,
          specifier: jsModuleReference.url,
          expectedType: "js_module",
        });
      } else if (context.build && !jsModuleUrlInfo.hasDependent()) {
        jsModuleUrlInfo.deleteFromGraph();
      }

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
        context.referenceUtils.foundSideEffectFile({
          sideEffectFileUrl: systemJsClientFileUrlDefault,
          expectedType: "js_classic",
          line: 0,
          column: 0,
        });
      }
      const { content, sourcemap } = await convertJsModuleToJsClassic({
        rootDirectoryUrl: context.rootDirectoryUrl,
        input: jsModuleUrlInfo.content,
        inputIsEntryPoint: urlInfo.isEntryPoint,
        inputSourcemap: jsModuleUrlInfo.sourcemap,
        inputUrl: jsModuleUrlInfo.url,
        outputUrl: jsModuleUrlInfo.generatedUrl,
        outputFormat,
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
