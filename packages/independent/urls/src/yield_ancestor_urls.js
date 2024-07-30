import { ensurePathnameTrailingSlash } from "./url_utils.js";

export function* yieldAncestorUrls(url, rootUrl, { yieldSelf } = {}) {
  url = String(url);
  if (rootUrl) rootUrl = ensurePathnameTrailingSlash(String(rootUrl));
  let currentUrl = url;
  if (yieldSelf && currentUrl !== rootUrl) {
    yield currentUrl;
  }
  while (currentUrl !== rootUrl && currentUrl !== "file:///") {
    currentUrl = getParentUrl(currentUrl);
    yield currentUrl;
  }
}

const getParentUrl = (url) => {
  if (url.startsWith("file://")) {
    // With node.js new URL('../', 'file:///C:/').href
    // returns "file:///C:/" instead of "file:///"
    const resource = url.slice("file://".length);
    const slashLastIndex = resource.lastIndexOf("/");
    if (slashLastIndex === -1) {
      return url;
    }
    const lastCharIndex = resource.length - 1;
    if (slashLastIndex === lastCharIndex) {
      const slashBeforeLastIndex = resource.lastIndexOf(
        "/",
        slashLastIndex - 1,
      );
      if (slashBeforeLastIndex === -1) {
        return url;
      }
      return `file://${resource.slice(0, slashBeforeLastIndex + 1)}`;
    }
    return `file://${resource.slice(0, slashLastIndex + 1)}`;
  }
  return new URL(url.endsWith("/") ? "../" : "./", url).href;
};
