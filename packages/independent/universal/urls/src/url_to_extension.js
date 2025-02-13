import { urlToPathname } from "./url_to_pathname.js";

export const urlToExtension = (url) => {
  const pathname = urlToPathname(url);
  return pathnameToExtension(pathname);
};

const pathnameToExtension = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }

  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return "";
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = pathname.slice(dotLastIndex);
  return extension;
};
