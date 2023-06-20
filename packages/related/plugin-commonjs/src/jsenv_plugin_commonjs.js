import { URL_META } from "@jsenv/url-meta";
import { injectQueryParams, urlToExtension } from "@jsenv/urls";
import { defaultLookupPackageScope } from "@jsenv/node-esm-resolution";

import { commonJsToJsModule } from "./cjs_to_esm.js";

const compileCacheDirectoryUrl = new URL("../.cache/", import.meta.url);

export const jsenvPluginCommonJs = ({
  name = "jsenv:commonjs",
  logLevel,
  include,
}) => {
  const markAsJsModuleProxy = (reference) => {
    reference.expectedType = "js_module";
    const packageFileUrl = defaultLookupPackageScope(reference.url);
    if (packageFileUrl) {
      reference.filename = `${reference.specifier}${urlToExtension(
        reference.ownerUrlInfo.url,
      )}`;
    }
  };
  const turnIntoJsModuleProxy = (reference) => {
    const urlTransformed = injectQueryParams(reference.url, {
      cjs_as_js_module: "",
    });
    markAsJsModuleProxy(reference);
    return urlTransformed;
  };

  let associations;

  return {
    name,
    appliesDuring: "*",
    init: ({ rootDirectoryUrl }) => {
      associations = URL_META.resolveAssociations(
        {
          commonjs: include,
        },
        rootDirectoryUrl,
      );
    },
    redirectReference: (reference) => {
      if (reference.searchParams.has("cjs_as_js_module")) {
        markAsJsModuleProxy(reference);
        return null;
      }
      const { commonjs } = URL_META.applyAssociations({
        url: reference.url,
        associations,
      });
      if (!commonjs) {
        return null;
      }
      reference.data.commonjs = commonjs;
      return turnIntoJsModuleProxy(reference);
    },
    fetchUrlContent: async (urlInfo, context) => {
      const commonJsReference = urlInfo.firstReference.getWithoutSearchParam({
        searchParam: "cjs_as_js_module",
        // during this fetch we don't want to alter the original file
        // so we consider it as text
        expectedType: "text",
      });
      if (!commonJsReference) {
        return null;
      }
      if (context.dev) {
        urlInfo.dependencies.found({
          type: "js_import",
          subtype: commonJsReference.subtype,
          specifier: commonJsReference.url,
          expectedType: "text",
        });
      } else if (context.build) {
        commonJsReference.remove();
      }
      const commonJsUrlInfo = commonJsReference.urlInfo;
      await commonJsUrlInfo.fetchUrlContent();
      const nodeRuntimeEnabled = Object.keys(context.runtimeCompat).includes(
        "node",
      );
      const { content, sourcemap, isValid } = await commonJsToJsModule({
        logLevel,
        compileCacheDirectoryUrl,
        sourceFileUrl: commonJsUrlInfo.url,
        browsers: !nodeRuntimeEnabled,
        processEnvNodeEnv: context.dev ? "development" : "production",
        ...urlInfo.data.commonjs,
      });
      if (isValid) {
        urlInfo.isValid = isValid;
      }
      return {
        content,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: commonJsUrlInfo.originalUrl,
        originalContent: commonJsUrlInfo.originalContent,
        sourcemap,
        data: commonJsUrlInfo.data,
      };
    },
  };
};
