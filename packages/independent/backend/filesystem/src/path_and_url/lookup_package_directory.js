import { existsSync } from "node:fs";
import { findAncestorDirectoryUrl } from "./find_ancestor_directory_url.js";

export const lookupPackageDirectory = (currentUrl) => {
  return findAncestorDirectoryUrl(currentUrl, (ancestorDirectoryUrl) => {
    const potentialPackageJsonFileUrl = `${ancestorDirectoryUrl}package.json`;
    return existsSync(new URL(potentialPackageJsonFileUrl));
  });
};
