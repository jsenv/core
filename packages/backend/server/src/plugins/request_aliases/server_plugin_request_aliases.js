import { URL_META } from "@jsenv/url-meta";

/**
 * Server plugin rewriting request resources before routing, from url
 * patterns to their replacement: `{ "/old/*": "/new/*", "/index": "/" }`
 * (patterns as in @jsenv/url-meta). The search params of the request are
 * kept unless the replacement has its own.
 *
 * @param {Object<string, string>} resourceAliases
 */
export const serverPluginRequestAliases = (resourceAliases) => {
  const aliases = {};
  Object.keys(resourceAliases).forEach((key) => {
    aliases[asFileUrl(key)] = asFileUrl(resourceAliases[key]);
  });
  return {
    name: "jsenv:request_aliases",
    redirectRequest: (request) => {
      const resourceBeforeAlias = request.resource;
      const urlAfterAliasing = URL_META.applyAliases({
        url: asFileUrl(request.pathname),
        aliases,
      });
      const resourceAfterAlias = urlAfterAliasing.slice("file://".length);
      if (resourceBeforeAlias === resourceAfterAlias) {
        return null;
      }
      const resource = replaceResource(resourceBeforeAlias, resourceAfterAlias);
      return { resource };
    },
  };
};

const asFileUrl = (specifier) => new URL(specifier, "file:///").href;

const replaceResource = (resourceBeforeAlias, newValue) => {
  const urlObject = new URL(resourceBeforeAlias, "file://");
  const searchSeparatorIndex = newValue.indexOf("?");
  if (searchSeparatorIndex > -1) {
    return newValue; // let new value override search params
  }
  urlObject.pathname = newValue;
  const resource = `${urlObject.pathname}${urlObject.search}`;
  return resource;
};
