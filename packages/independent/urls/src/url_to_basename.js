import { urlToFilename } from "./url_to_filename.js";

export const urlToBasename = (url, removeAllExtensions) => {
  const filename = urlToFilename(url);
  const basename = filenameToBasename(filename);
  if (!removeAllExtensions) {
    return basename;
  }
  let currentBasename = basename;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nextBasename = filenameToBasename(basename);
    if (nextBasename === currentBasename) {
      return currentBasename;
    }
    currentBasename = nextBasename;
  }
};

export const filenameToBasename = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  const basename =
    dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex);
  return basename;
};
