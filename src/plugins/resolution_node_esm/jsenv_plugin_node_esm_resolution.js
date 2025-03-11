import { createNodeEsmResolver } from "./node_esm_resolver.js";

export const jsenvPluginNodeEsmResolution = (resolutionConfig = {}) => {
  let nodeEsmResolverDefault;
  const resolvers = {};

  return {
    name: "jsenv:node_esm_resolution",
    appliesDuring: "*",
    init: (kitchenContext) => {
      nodeEsmResolverDefault = createNodeEsmResolver({
        build: kitchenContext.build,
        runtimeCompat: kitchenContext.runtimeCompat,
        preservesSymlink: true,
      });
      Object.keys(resolutionConfig).forEach((urlType) => {
        const config = resolutionConfig[urlType];
        if (config === true) {
          resolvers[urlType] = (...args) => nodeEsmResolverDefault(...args);
        } else if (config === false) {
          resolvers[urlType] = () => null;
        } else if (typeof config === "object") {
          const {
            runtimeCompat,
            packageConditions,
            preservesSymlink,
            ...rest
          } = config;
          const unexpectedKeys = Object.keys(rest);
          if (unexpectedKeys.length) {
            throw new TypeError(
              `${unexpectedKeys.join(
                ",",
              )}: there is no such configuration on "${urlType}"`,
            );
          }
          resolvers[urlType] = createNodeEsmResolver({
            build: kitchenContext.build,
            runtimeCompat,
            packageConditions,
            preservesSymlink,
          });
        } else {
          throw new TypeError(
            `config must be true, false or an object, got ${config} on "${urlType}"`,
          );
        }
      });

      if (resolvers.js_module === undefined) {
        resolvers.js_module = nodeEsmResolverDefault;
      }
      if (resolvers.js_classic === undefined) {
        resolvers.js_classic = (reference) => {
          if (reference.subtype === "self_import_scripts_arg") {
            return nodeEsmResolverDefault(reference);
          }
          if (reference.type === "js_import") {
            // happens for ?as_js_module
            return nodeEsmResolverDefault(reference);
          }
          return null;
        };
      }
    },
    resolveReference: (reference) => {
      if (reference.specifier.startsWith("node_esm:")) {
        reference.specifier = reference.specifier.slice("node_esm:".length);
        const result = nodeEsmResolverDefault(reference);
        return result;
      }
      const urlType = urlTypeFromReference(reference);
      const resolver = resolvers[urlType];
      return resolver ? resolver(reference) : null;
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
