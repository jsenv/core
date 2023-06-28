import { urlToOrigin } from "./url_to_origin.js";
import { urlToExtension } from "./url_to_extension.js";
import { urlToResource } from "./url_to_resource.js";

export const asUrlWithoutSearch = (url) => {
  if (url.includes("?")) {
    const urlObject = new URL(url);
    urlObject.search = "";
    return urlObject.href;
  }
  return url;
};

export const isValidUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

// normalize url search params:
// Using URLSearchParams to alter the url search params
// can result into "file:///file.css?css_module"
// becoming "file:///file.css?css_module="
// we want to get rid of the "=" and consider it's the same url
export const normalizeUrl = (url) => {
  if (url.includes("?")) {
    // disable on data urls (would mess up base64 encoding)
    if (url.startsWith("data:")) {
      return url;
    }
    return url.replace(/[=](?=&|$)/g, "");
  }
  return url;
};

export const injectQueryParamsIntoSpecifier = (specifier, params) => {
  if (isValidUrl(specifier)) {
    return injectQueryParams(specifier, params);
  }
  const [beforeQuestion, afterQuestion = ""] = specifier.split("?");
  const searchParams = new URLSearchParams(afterQuestion);
  Object.keys(params).forEach((key) => {
    searchParams.set(key, params[key]);
  });
  const paramsString = searchParams.toString();
  if (paramsString) {
    return `${beforeQuestion}?${paramsString}`;
  }
  return specifier;
};

export const injectQueryParams = (url, params) => {
  const urlObject = new URL(url);
  const { searchParams } = urlObject;
  Object.keys(params).forEach((key) => {
    const value = params[key];
    searchParams.set(key, value);
  });
  const urlWithParams = urlObject.href;
  return urlWithParams;
};

export const injectQueryParamWithoutEncoding = (url, key, value) => {
  const urlObject = new URL(url);
  let { origin, pathname, search, hash } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  if (search === "") {
    search = `?${key}=${value}`;
  } else {
    search += `${key}=${value}`;
  }
  return `${origin}${pathname}${search}${hash}`;
};
export const injectQueryParamIntoSpecifierWithoutEncoding = (
  specifier,
  key,
  value,
) => {
  if (isValidUrl(specifier)) {
    return injectQueryParams(specifier, key, value);
  }
  const [beforeQuestion, afterQuestion = ""] = specifier.split("?");
  const searchParams = new URLSearchParams(afterQuestion);
  let search = searchParams.toString();
  if (search === "") {
    search = `?${key}=${value}`;
  } else {
    search += `${key}=${value}`;
  }
  return `${beforeQuestion}${search}`;
};

export const renderUrlOrRelativeUrlFilename = (urlOrRelativeUrl, renderer) => {
  const questionIndex = urlOrRelativeUrl.indexOf("?");
  const beforeQuestion =
    questionIndex === -1
      ? urlOrRelativeUrl
      : urlOrRelativeUrl.slice(0, questionIndex);
  const afterQuestion =
    questionIndex === -1 ? "" : urlOrRelativeUrl.slice(questionIndex);
  const beforeLastSlash = beforeQuestion.endsWith("/")
    ? beforeQuestion.slice(0, -1)
    : beforeQuestion;
  const slashLastIndex = beforeLastSlash.lastIndexOf("/");
  const beforeFilename =
    slashLastIndex === -1 ? "" : beforeQuestion.slice(0, slashLastIndex + 1);
  const filename =
    slashLastIndex === -1
      ? beforeQuestion
      : beforeQuestion.slice(slashLastIndex + 1);
  const dotLastIndex = filename.lastIndexOf(".");
  const basename =
    dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex);
  const extension = dotLastIndex === -1 ? "" : filename.slice(dotLastIndex);
  const newFilename = renderer({
    basename,
    extension,
  });
  return `${beforeFilename}${newFilename}${afterQuestion}`;
};

export const setUrlExtension = (url, extension) => {
  const origin = urlToOrigin(url);
  const currentExtension = urlToExtension(url);
  const resource = urlToResource(url);
  const [pathname, search] = resource.split("?");
  const pathnameWithoutExtension = currentExtension
    ? pathname.slice(0, -currentExtension.length)
    : pathname;
  const newPathname = `${pathnameWithoutExtension}${extension}`;
  return `${origin}${newPathname}${search ? `?${search}` : ""}`;
};

export const setUrlFilename = (url, filename) => {
  const urlObject = new URL(url);
  let { origin, search, hash } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  const parentPathname = new URL("./", urlObject).pathname;
  return `${origin}${parentPathname}${filename}${search}${hash}`;
};

export const ensurePathnameTrailingSlash = (url) => {
  const urlObject = new URL(url);
  const { pathname } = urlObject;
  if (pathname.endsWith("/")) {
    return url;
  }
  let { origin } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  const { search, hash } = urlObject;
  return `${origin}${pathname}/${search}${hash}`;
};

export const asUrlUntilPathname = (url) => {
  const urlObject = new URL(url);
  let { origin, pathname } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  const urlUntilPathname = `${origin}${pathname}`;
  return urlUntilPathname;
};
