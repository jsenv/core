import { urlToPathname } from "./url_to_pathname.js";

export const urlToFilename = (url) => {
  const pathname = urlToPathname(url);
  return pathnameToFilename(pathname);
};

export const pathnameToFilename = (pathname) => {
  const pathnameBeforeLastSlash = pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/");
  const filename =
    slashLastIndex === -1
      ? pathnameBeforeLastSlash
      : pathnameBeforeLastSlash.slice(slashLastIndex + 1);
  return filename;
};
