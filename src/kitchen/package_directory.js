import {
  lookupPackageDirectory as lookupPackageDirectoryDefault,
  readPackageAtOrNull,
} from "@jsenv/filesystem";
import { statSync } from "node:fs";

export const createPackageDirectory = ({
  sourceDirectoryUrl,
  lookupPackageDirectory = lookupPackageDirectoryDefault,
}) => {
  // package.json files are read constantly: node esm resolution reads them
  // for every bare specifier, the kitchen for every package relationship.
  // The cache is validated by mtime so a package.json change while a
  // process keeps running (npm install during a dev server or a watch
  // build) is seen immediately, at the cost of a single stat per read.
  const readCache = new Map();
  const read = (packageDirectoryUrl) => {
    const key = String(packageDirectoryUrl);
    let mtimeMs;
    try {
      mtimeMs = statSync(new URL("./package.json", key)).mtimeMs;
    } catch (e) {
      if (e.code === "ENOENT") {
        return null;
      }
      throw e;
    }
    const fromCache = readCache.get(key);
    if (fromCache && fromCache.mtimeMs === mtimeMs) {
      return fromCache.packageJson;
    }
    const packageJson = readPackageAtOrNull(key);
    readCache.set(key, { mtimeMs, packageJson });
    return packageJson;
  };

  const packageDirectory = {
    url: lookupPackageDirectory(sourceDirectoryUrl),
    find: (url) => {
      const urlString = typeof url === "string" ? url : url?.href;
      if (!urlString.startsWith("file:")) {
        return null;
      }
      return lookupPackageDirectory(url);
    },
    read,
  };
  return packageDirectory;
};
