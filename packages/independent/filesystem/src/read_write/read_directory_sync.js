import { readdirSync } from "node:fs";

import { assertAndNormalizeDirectoryUrl } from "../path_and_url/directory_url_validation.js";

export const readDirectorySync = (url) => {
  const directoryUrl = assertAndNormalizeDirectoryUrl(url);
  const directoryUrlObject = new URL(directoryUrl);
  const names = readdirSync(directoryUrlObject);
  return names.map(encodeURIComponent);
};
