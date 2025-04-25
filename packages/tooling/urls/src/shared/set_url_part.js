import { filenameToBasename } from "./url_to_basename.js";
import { urlToExtension } from "./url_to_extension.js";
import { pathnameToFilename } from "./url_to_filename.js";
import { urlToOrigin } from "./url_to_origin.js";
import { urlToResource } from "./url_to_resource.js";

export const setUrlExtension = (url, extension) => {
  const origin = urlToOrigin(url);
  const currentExtension = urlToExtension(url);
  if (typeof extension === "function") {
    extension = extension(currentExtension);
  }
  const resource = urlToResource(url);
  const [pathname, search] = resource.split("?");
  const pathnameWithoutExtension = currentExtension
    ? pathname.slice(0, -currentExtension.length)
    : pathname;
  let newPathname;
  if (pathnameWithoutExtension.endsWith("/")) {
    newPathname = pathnameWithoutExtension.slice(0, -1);
    newPathname += extension;
    newPathname += "/";
  } else {
    newPathname = pathnameWithoutExtension;
    newPathname += extension;
  }
  return `${origin}${newPathname}${search ? `?${search}` : ""}`;
};

export const setUrlFilename = (url, filename) => {
  const parentPathname = new URL("./", url).pathname;
  return transformUrlPathname(url, (pathname) => {
    if (typeof filename === "function") {
      filename = filename(pathnameToFilename(pathname));
    }
    return `${parentPathname}${filename}`;
  });
};

export const setUrlBasename = (url, basename) => {
  return setUrlFilename(url, (filename) => {
    if (typeof basename === "function") {
      basename = basename(filenameToBasename(filename));
    }
    return `${basename}${urlToExtension(url)}`;
  });
};

const transformUrlPathname = (url, transformer) => {
  if (typeof url === "string") {
    const urlObject = new URL(url);
    const { pathname } = urlObject;
    const pathnameTransformed = transformer(pathname);
    if (pathnameTransformed === pathname) {
      return url;
    }
    let { origin } = urlObject;
    // origin is "null" for "file://" urls with Node.js
    if (origin === "null" && urlObject.href.startsWith("file:")) {
      origin = "file://";
    }
    const { search, hash } = urlObject;
    const urlWithPathnameTransformed = `${origin}${pathnameTransformed}${search}${hash}`;
    return urlWithPathnameTransformed;
  }
  const pathnameTransformed = transformer(url.pathname);
  url.pathname = pathnameTransformed;
  return url;
};
export const ensurePathnameTrailingSlash = (url) => {
  return transformUrlPathname(url, (pathname) => {
    return pathname.endsWith("/") ? pathname : `${pathname}/`;
  });
};
export const removePathnameTrailingSlash = (url) => {
  return transformUrlPathname(url, (pathname) => {
    return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  });
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
