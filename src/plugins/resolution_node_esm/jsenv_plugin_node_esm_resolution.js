import { createNodeEsmResolver } from "./node_esm_resolver.js";

export const jsenvPluginNodeEsmResolution = ({
  packageDirectory,
  resolutionConfig = {},
  packageConditions,
  packageConditionsConfig = {},
}) => {
  let nodeEsmResolverDefault;
  const resolverMap = new Map();
  let anyTypeResolver;

  const resolverFromObject = (
    { preservesSymlink, ...rest },
    { kitchenContext, urlType },
  ) => {
    const unexpectedKeys = Object.keys(rest);
    if (unexpectedKeys.length) {
      throw new TypeError(
        `${unexpectedKeys.join(
          ",",
        )}: there is no such configuration on "${urlType}"`,
      );
    }
    return createNodeEsmResolver({
      packageDirectory,
      runtimeCompat: kitchenContext.runtimeCompat,
      rootDirectoryUrl: kitchenContext.rootDirectoryUrl,
      packageConditions,
      packageConditionsConfig: {
        ...kitchenContext.packageConditionsConfig,
        ...packageConditionsConfig,
      },
      preservesSymlink,
    });
  };

  return {
    name: "jsenv:node_esm_resolution",
    appliesDuring: "*",
    init: (kitchenContext) => {
      nodeEsmResolverDefault = createNodeEsmResolver({
        packageDirectory,
        runtimeCompat: kitchenContext.runtimeCompat,
        rootDirectoryUrl: kitchenContext.rootDirectoryUrl,
        // preservesSymlink: true,
        packageConditions,
        packageConditionsConfig: {
          ...kitchenContext.packageConditionsConfig,
          ...packageConditionsConfig,
        },
      });
      for (const urlType of Object.keys(resolutionConfig)) {
        let resolver;
        const config = resolutionConfig[urlType];
        if (config === true) {
          resolver = nodeEsmResolverDefault;
        } else if (config === false) {
          resolver = null;
        } else if (typeof config === "object") {
          resolver = resolverFromObject(config, { kitchenContext, urlType });
        } else {
          throw new TypeError(
            `The value "${config}" for ${urlType} in nodeEsmResolution is invalid: it must be true, false or an object.`,
          );
        }

        if (urlType === "*") {
          anyTypeResolver = resolver;
        } else {
          resolverMap.set(urlType, resolver);
        }
      }
      if (!anyTypeResolver) {
        anyTypeResolver = nodeEsmResolverDefault;
      }

      if (!resolverMap.has("js_module")) {
        resolverMap.set("js_module", nodeEsmResolverDefault);
      }
      if (!resolverMap.has("js_classic")) {
        resolverMap.set("js_classic", (reference) => {
          if (reference.subtype === "self_import_scripts_arg") {
            return nodeEsmResolverDefault(reference);
          }
          if (reference.type === "js_import") {
            // happens for ?as_js_module
            return nodeEsmResolverDefault(reference);
          }
          return null;
        });
      }
    },
    resolveReference: (reference) => {
      if (reference.specifier.startsWith("node_esm:")) {
        reference.specifier = reference.specifier.slice("node_esm:".length);
        const result = nodeEsmResolverDefault(reference);
        return result;
      }
      const urlType = urlTypeFromReference(reference);
      const resolver = resolverMap.get(urlType);
      if (resolver !== undefined) {
        if (typeof resolver === "function") {
          return resolver(reference);
        }
        return resolver;
      }
      if (anyTypeResolver) {
        return anyTypeResolver(reference);
      }
      return null;
    },
    // when specifier is prefixed by "file:///@ignore/"
    // we return an empty js module
    fetchUrlContent: (urlInfo) => {
      if (urlInfo.url.startsWith("file:///@ignore/")) {
        return {
          content: "export default {}",
          contentType: "text/javascript",
          type: "js_module",
        };
      }
      return null;
    },
  };
};

const urlTypeFromReference = (reference) => {
  if (reference.type === "sourcemap_comment") {
    return "sourcemap";
  }
  if (reference.injected) {
    return reference.expectedType;
  }
  return reference.ownerUrlInfo.type;
};
