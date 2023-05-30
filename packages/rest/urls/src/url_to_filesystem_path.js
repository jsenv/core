import { fileURLToPath } from "node:url";

export const urlToFileSystemPath = (url) => {
  let urlString = String(url);
  if (urlString[urlString.length - 1] === "/") {
    // remove trailing / so that nodejs path becomes predictable otherwise it logs
    // the trailing slash on linux but does not on windows
    urlString = urlString.slice(0, -1);
  }
  const fileSystemPath = fileURLToPath(urlString);
  return fileSystemPath;
};
