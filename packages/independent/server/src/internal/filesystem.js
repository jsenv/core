import { fileURLToPath, pathToFileURL } from "node:url";

export const isFileSystemPath = (value) => {
  if (typeof value !== "string") {
    throw new TypeError(
      `isFileSystemPath first arg must be a string, got ${value}`,
    );
  }

  if (value[0] === "/") {
    return true;
  }

  return startsWithWindowsDriveLetter(value);
};

const startsWithWindowsDriveLetter = (string) => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;

  const secondChar = string[1];
  if (secondChar !== ":") return false;

  return true;
};

export const fileSystemPathToUrl = (value) => {
  if (!isFileSystemPath(value)) {
    throw new Error(`received an invalid value for fileSystemPath: ${value}`);
  }
  return String(pathToFileURL(value));
};

export const urlToFileSystemPath = (url) => {
  const urlObject = new URL(url);
  let urlString;
  if (urlObject.hash) {
    const origin =
      urlObject.protocol === "file:" ? "file://" : urlObject.origin;
    urlString = `${origin}${urlObject.pathname}${urlObject.search}%23${urlObject.hash.slice(1)}`;
  } else {
    urlString = urlObject.href;
  }
  const fileSystemPath = fileURLToPath(urlString);
  if (fileSystemPath[fileSystemPath.length - 1] === "/") {
    // remove trailing / so that nodejs path becomes predictable otherwise it logs
    // the trailing slash on linux but does not on windows
    return fileSystemPath.slice(0, -1);
  }
  return fileSystemPath;
};
