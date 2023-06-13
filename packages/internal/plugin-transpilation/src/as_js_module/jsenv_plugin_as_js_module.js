/*
 * Js modules might not be able to import js meant to be loaded by <script>
 * Among other things this happens for a top level this:
 * - With <script> this is window
 * - With an import this is undefined
 * Example of this: https://github.com/video-dev/hls.js/issues/2911
 *
 * This plugin fix this issue by rewriting top level this into window
 * and can be used like this for instance import("hls?as_js_module")
 */

import { urlToFilename } from "@jsenv/urls";

import { convertJsClassicToJsModule } from "./convert_js_classic_to_js_module.js";

export const jsenvPluginAsJsModule = () => {
  return {
    name: "jsenv:as_js_module",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.searchParams.has("as_js_module")) {
        reference.expectedType = "js_module";
        const filename = urlToFilename(reference.url);
        const [basename] = splitFileExtension(filename);
        reference.filename = `${basename}.mjs`;
      }
    },
    fetchUrlContent: async (urlInfo, context) => {
      const [jsClassicReference, jsClassicUrlInfo] =
        context.reference.getWithoutSearchParam({
          searchParam: "as_js_module",
          // override the expectedType to "js_classic"
          // because when there is ?as_js_module it means the underlying resource
          // is js_classic
          expectedType: "js_classic",
        });
      if (!jsClassicReference) {
        return null;
      }
      await context.fetchUrlContent(jsClassicUrlInfo, {
        reference: jsClassicReference,
      });
      if (context.dev) {
        context.referenceUtils.found({
          type: "js_import",
          subtype: jsClassicReference.subtype,
          specifier: jsClassicReference.url,
          expectedType: "js_classic",
        });
      } else if (context.build && !jsClassicUrlInfo.hasDependent()) {
        jsClassicUrlInfo.deleteFromGraph();
      }
      const { content, sourcemap } = await convertJsClassicToJsModule({
        input: jsClassicUrlInfo.content,
        inputSourcemap: jsClassicUrlInfo.sourcemap,
        inputUrl: jsClassicUrlInfo.url,
        outputUrl: jsClassicUrlInfo.generatedUrl,
        isWebWorker: isWebWorkerUrlInfo(urlInfo),
      });
      return {
        content,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: jsClassicUrlInfo.originalUrl,
        originalContent: jsClassicUrlInfo.originalContent,
        sourcemap,
        data: jsClassicUrlInfo.data,
      };
    },
  };
};

const isWebWorkerUrlInfo = (urlInfo) => {
  return (
    urlInfo.subtype === "worker" ||
    urlInfo.subtype === "service_worker" ||
    urlInfo.subtype === "shared_worker"
  );
};

const splitFileExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};
