import { fileURLToPath } from "node:url";

export const urlToFileSystemPath = (url) => {
  const urlObject = new URL(url);
  let urlString = String(url);
  if (urlString[urlString.length - 1] === "/") {
    // remove trailing / so that nodejs path becomes predictable otherwise it logs
    // the trailing slash on linux but does not on windows
    urlString = urlString.slice(0, -1);
  }
  if (urlObject.hash) {
    const origin =
      urlObject.protocol === "file:" ? "file://" : urlObject.origin;
    urlString = `${origin}${urlObject.pathname}${urlObject.search}%23${urlObject.hash.slice(1)}`;
  }
  const fileSystemPath = fileURLToPath(urlString);
  return fileSystemPath;
};
