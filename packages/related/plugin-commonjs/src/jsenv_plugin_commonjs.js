// for reference this is how Node.js detect module format https://github.com/nodejs/node/blob/a446e3bdc96b0f263fd363ce89b9c739b066240f/lib/internal/modules/esm/get_format.js#L1
import {
  applyNodeEsmResolution,
  defaultLookupPackageScope,
} from "@jsenv/node-esm-resolution";
import { URL_META } from "@jsenv/url-meta";
import {
  injectQueryParams,
  pathnameToExtension,
  urlToBasename,
  urlToExtension,
} from "@jsenv/urls";
import { commonJsToJsModule } from "./cjs_to_esm.js";

const compileCacheDirectoryUrlDefault = new URL("../.cache/", import.meta.url);

export const jsenvPluginCommonJs = ({
  name = "jsenv:commonjs",
  logLevel,
  include,
  compileCacheDirectoryUrl,
  dev,
} = {}) => {
  const markAsJsModuleProxy = (reference) => {
    reference.expectedType = "js_module";
    const onwerUrlExtension = urlToExtension(reference.ownerUrlInfo.url);
    const referenceUrlExtension = urlToExtension(reference.url);
    if (referenceUrlExtension !== onwerUrlExtension) {
      const packageFileUrl = defaultLookupPackageScope(reference.url);
      if (packageFileUrl) {
        const basename = isBareSpecifier(reference.specifier)
          ? reference.specifier
          : urlToBasename(reference.url);
        reference.filenameHint = `${basename}${onwerUrlExtension}`;
      }
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
  let nodeRuntimeEnabled;

  const packageConditionsConfig = {};
  const onIncludedUrl = (url) => {
    url = String(url);
    if (url.endsWith(".map")) {
      return;
    }
    packageConditionsConfig[url] = ["node", "import", "require"];
  };

  return {
    name,
    appliesDuring: "*",
    init: (kitchenContext) => {
      const { rootDirectoryUrl, outDirectoryUrl, runtimeCompat } =
        kitchenContext;
      kitchenContext.packageConditionsConfig = packageConditionsConfig;

      associations = URL_META.resolveAssociations(
        {
          commonjs: {
            ...include,
            "/**/*.map": false,
          },
        },
        (pattern) => {
          if (!isBareSpecifier(pattern)) {
            const url = new URL(pattern, rootDirectoryUrl);
            onIncludedUrl(url);
            return url;
          }
          try {
            if (!pattern.endsWith("/") && !pathnameToExtension(pattern)) {
              pattern = `${pattern}/`;
            }
            if (pattern.endsWith("/")) {
              // avoid package path not exported
              const { packageDirectoryUrl } = applyNodeEsmResolution({
                specifier: pattern.slice(0, -1),
                parentUrl: rootDirectoryUrl,
              });
              onIncludedUrl(packageDirectoryUrl);
              return packageDirectoryUrl;
            }
            const { url } = applyNodeEsmResolution({
              specifier: pattern,
              parentUrl: rootDirectoryUrl,
            });
            onIncludedUrl(url);
            return url;
          } catch {
            const url = new URL(pattern, rootDirectoryUrl);
            onIncludedUrl(url);
            return url;
          }
        },
      );
      nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
      if (compileCacheDirectoryUrl === undefined) {
        if (outDirectoryUrl) {
          compileCacheDirectoryUrl = new URL("./cjs_to_esm/", outDirectoryUrl)
            .href;
        } else {
          compileCacheDirectoryUrl = compileCacheDirectoryUrlDefault;
        }
      }
    },
    redirectReference: (reference) => {
      if (reference.type === "sourcemap_comment") {
        return null;
      }
      if (reference.searchParams.has("cjs_as_js_module")) {
        markAsJsModuleProxy(reference);
        return null;
      }
      // when search param is injected, it will be removed later
      // by "getWithoutSearchParam". We don't want to redirect again
      // (would create infinite recursion)
      if (
        reference.prev &&
        reference.prev.searchParams.has(`cjs_as_js_module`)
      ) {
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
    fetchUrlContent: async (urlInfo) => {
      const commonJsUrlInfo = urlInfo.getWithoutSearchParam("cjs_as_js_module");
      if (!commonJsUrlInfo) {
        return null;
      }
      // during this fetch we don't want to alter the original file
      // so we consider it as text
      commonJsUrlInfo.type = "text";
      await commonJsUrlInfo.cook();
      const { content, sourcemap, isValid } = await commonJsToJsModule({
        logLevel,
        compileCacheDirectoryUrl,
        sourceFileUrl: commonJsUrlInfo.url,
        browsers: !nodeRuntimeEnabled,
        processEnvNodeEnv:
          dev || urlInfo.context.dev ? "development" : "production",
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

const isBareSpecifier = (specifier) => {
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(specifier);
    return false;
  } catch {
    return true;
  }
};
