import { existsSync, readFileSync } from "node:fs";
import { findSelfOrAncestorDirectoryUrl } from "./find_self_or_ancestor_directory_url.js";
import { getParentDirectoryUrl } from "./get_parent_directory_url.js";

export const lookupPackageDirectory = (currentUrl) => {
  return findSelfOrAncestorDirectoryUrl(currentUrl, (ancestorDirectoryUrl) => {
    const potentialPackageJsonFileUrl = `${ancestorDirectoryUrl}package.json`;
    return existsSync(new URL(potentialPackageJsonFileUrl));
  });
};

export const createLookupPackageDirectory = () => {
  const cache = new Map();
  const lookupPackageDirectoryWithCache = (currentUrl) => {
    const directoryUrls = [];
    currentUrl = String(currentUrl);
    if (currentUrl.endsWith("/")) {
      directoryUrls.push(currentUrl);
    } else {
      const directoryUrl = new URL("./", currentUrl).href;
      directoryUrls.push(directoryUrl);
      currentUrl = directoryUrl;
    }
    while (currentUrl !== "file:///") {
      const fromCache = cache.get(currentUrl);
      if (fromCache !== undefined) {
        return fromCache;
      }
      const packageJsonUrlCandidate = `${currentUrl}package.json`;
      if (existsSync(new URL(packageJsonUrlCandidate))) {
        for (const directoryUrl of directoryUrls) {
          cache.set(directoryUrl, currentUrl);
        }
        return currentUrl;
      }
      const directoryUrl = getParentDirectoryUrl(currentUrl);
      directoryUrls.push(directoryUrl);
      currentUrl = directoryUrl;
    }
    for (const directoryUrl of directoryUrls) {
      cache.set(directoryUrl, null);
    }
    return null;
  };
  lookupPackageDirectoryWithCache.clearCache = () => {
    cache.clear();
  };
  return lookupPackageDirectoryWithCache;
};

export const readPackageAtOrNull = (packageDirectoryUrl) => {
  try {
    const packageFileContent = readFileSync(
      new URL("./package.json", packageDirectoryUrl),
      "utf8",
    );
    const packageJSON = JSON.parse(packageFileContent);
    return packageJSON;
  } catch {
    return null;
  }
};
