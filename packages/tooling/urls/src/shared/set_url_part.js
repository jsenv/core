import { filenameToBasename } from "./url_to_basename.js";
import { urlToExtension } from "./url_to_extension.js";
import { pathnameToFilename } from "./url_to_filename.js";

export const setUrlExtension = (
  url,
  extension,
  { trailingSlash = "preserve" } = {},
) => {
  return transformUrlPathname(url, (pathname) => {
    const currentExtension = urlToExtension(url);
    if (typeof extension === "function") {
      extension = extension(currentExtension);
    }
    const pathnameWithoutExtension = currentExtension
      ? pathname.slice(0, -currentExtension.length)
      : pathname;

    if (pathnameWithoutExtension.endsWith("/")) {
      let pathnameWithExtension;
      pathnameWithExtension = pathnameWithoutExtension.slice(0, -1);
      pathnameWithExtension += extension;
      if (trailingSlash === "preserve") {
        pathnameWithExtension += "/";
      }
      return pathnameWithExtension;
    }
    let pathnameWithExtension = pathnameWithoutExtension;
    pathnameWithExtension += extension;
    return pathnameWithExtension;
  });
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
