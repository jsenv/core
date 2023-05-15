import { urlTypeFromReference } from "../url_type_from_reference.js";
import { createNodeEsmResolver } from "./node_esm_resolver.js";

export const jsenvPluginNodeEsmResolution = (resolutionConfig = {}) => {
  let nodeEsmResolverDefault;
  const resolvers = {};
  Object.keys(resolutionConfig).forEach((urlType) => {
    const config = resolutionConfig[urlType];
    if (config === true) {
      resolvers[urlType] = (...args) => nodeEsmResolverDefault(...args);
    } else if (config === false) {
      resolvers[urlType] = () => null;
    } else if (typeof config === "object") {
      const { runtimeCompat, packageConditions, preservesSymlink, ...rest } =
        config;
      const unexpectedKeys = Object.keys(rest);
      if (unexpectedKeys.length) {
        throw new TypeError(
          `${unexpectedKeys.join(
            ",",
          )}: there is no such configuration on "${urlType}"`,
        );
      }
      resolvers[urlType] = createNodeEsmResolver({
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

  return {
    name: "jsenv:node_esm_resolution",
    init: ({ runtimeCompat }) => {
      nodeEsmResolverDefault = createNodeEsmResolver({
        runtimeCompat,
        preservesSymlink: true,
      });
      if (!resolvers.js_module) {
        resolvers.js_module = nodeEsmResolverDefault;
      }
      if (!resolvers.js_classic) {
        resolvers.js_classic = (reference, context) => {
          if (reference.subtype === "self_import_scripts_arg") {
            return nodeEsmResolverDefault(reference, context);
          }
          return null;
        };
      }
    },
    resolveUrl: (reference, context) => {
      const urlType = urlTypeFromReference(reference, context);
      const resolver = resolvers[urlType];
      return resolver ? resolver(reference, context) : null;
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
