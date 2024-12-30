import { getParentDirectoryUrl } from "./get_parent_directory_url.js";

export const findAncestorDirectoryUrl = (url, callback) => {
  url = String(url);
  while (url !== "file:///") {
    if (callback(url)) {
      return url;
    }
    url = getParentDirectoryUrl(url);
  }
  return null;
};
