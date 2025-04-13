import { pathnameToExtension } from "./internal/pathname_to_extension.js";
import { urlToPathname } from "./url_to_pathname.js";

export const urlToExtension = (url) => {
  const pathname = urlToPathname(url);
  return pathnameToExtension(pathname);
};
