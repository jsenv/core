/*
 * A request target is the text between the method and the http version on the
 * request line (RFC 9112 section 3.2), or the ":path" pseudo header in http2.
 * It is a path, not a url reference, and the two must never be confused:
 * "//wp-includes/x" is an origin-form target whose first path segment is
 * empty, but `new URL("//wp-includes/x", origin)` reads it as a
 * protocol-relative reference and turns "wp-includes" into the host. So the
 * path is assigned onto the origin instead, and what a client sends can never
 * replace that origin.
 *
 * The one form that legitimately names an origin is absolute-form
 * ("GET http://host/path", sent by proxies and open-proxy scanners); it is
 * read as such so the origin it names goes through the allowedHosts check
 * like any other host, instead of reaching the routes unchecked.
 */

const ABSOLUTE_FORM_REGEX = /^[a-z][a-z0-9+\-.]*:\/\//i;

/**
 * @param {string} target the raw request target
 * @returns {{ origin: string|null, host: string|null, resource: string }|null}
 *   null when the target cannot be read; the server answers 400
 */
export const readRequestTarget = (target) => {
  if (!ABSOLUTE_FORM_REGEX.test(target)) {
    // origin-form ("/path?query"), asterisk-form ("*") or authority-form
    return { origin: null, host: null, resource: target };
  }
  if (!URL.canParse(target)) {
    return null;
  }
  const urlObject = new URL(target);
  if (urlObject.protocol !== "http:" && urlObject.protocol !== "https:") {
    return null;
  }
  return {
    origin: urlObject.origin,
    host: urlObject.host,
    resource: `${urlObject.pathname}${urlObject.search}`,
  };
};

// the search of baseUrl is dropped: the resource carries its own
export const resourceToUrlObject = (resource, baseUrl) => {
  const urlObject = new URL(baseUrl);
  const searchSeparatorIndex = resource.indexOf("?");
  if (searchSeparatorIndex === -1) {
    urlObject.pathname = resource;
    urlObject.search = "";
  } else {
    urlObject.pathname = resource.slice(0, searchSeparatorIndex);
    urlObject.search = resource.slice(searchSeparatorIndex);
  }
  return urlObject;
};
