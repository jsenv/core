import { existsSync, readFileSync } from "node:fs";
import { findAncestorDirectoryUrl } from "./find_ancestor_directory_url.js";

export const lookupPackageDirectory = (currentUrl) => {
  return findAncestorDirectoryUrl(currentUrl, (ancestorDirectoryUrl) => {
    const potentialPackageJsonFileUrl = `${ancestorDirectoryUrl}package.json`;
    return existsSync(new URL(potentialPackageJsonFileUrl));
  });
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
