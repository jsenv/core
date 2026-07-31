/*
 * Compares what the project package.json declares with what is actually inside
 * node_modules, so the dev server can tell a dependency apart when it is
 * missing (never installed) or outdated (installed at an other version).
 *
 * Only exact declared versions ("1.2.3") are compared: a range ("^1.2.3"), a
 * file/workspace protocol or a tag cannot be checked without resolving what npm
 * would pick, which is way beyond what is needed here.
 */

import { existsSync } from "node:fs";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
];

export const packageNameFromSpecifier = (specifier) => {
  const parts = specifier.split("/");
  if (specifier[0] === "@") {
    return parts.slice(0, 2).join("/");
  }
  return parts[0];
};

export const readDependencyStatus = (packageDirectory, packageName) => {
  const declaredVersion = readDeclaredVersion(packageDirectory, packageName);
  if (!declaredVersion) {
    return null;
  }
  return createStatus(packageDirectory, packageName, declaredVersion);
};

export const readDependencyStatuses = (packageDirectory) => {
  const packageJSON = readPackageJSON(packageDirectory, packageDirectory.url);
  if (!packageJSON) {
    return [];
  }
  const statuses = [];
  const packageNameSet = new Set();
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = packageJSON[field];
    if (!dependencies) {
      continue;
    }
    for (const packageName of Object.keys(dependencies)) {
      if (packageNameSet.has(packageName)) {
        continue;
      }
      packageNameSet.add(packageName);
      statuses.push(
        createStatus(packageDirectory, packageName, dependencies[packageName]),
      );
    }
  }
  return statuses;
};

const createStatus = (packageDirectory, packageName, declaredVersion) => {
  const installedDirectoryUrl = findInstalledDirectoryUrl(
    packageDirectory,
    packageName,
  );
  if (!installedDirectoryUrl) {
    return {
      packageName,
      declaredVersion,
      installedVersion: null,
      state: "missing",
    };
  }
  const installedPackageJSON = readPackageJSON(
    packageDirectory,
    installedDirectoryUrl,
  );
  const installedVersion = installedPackageJSON
    ? installedPackageJSON.version
    : null;
  const state =
    isExactVersion(declaredVersion) && installedVersion !== declaredVersion
      ? "outdated"
      : "installed";
  return { packageName, declaredVersion, installedVersion, state };
};

const findInstalledDirectoryUrl = (packageDirectory, packageName) => {
  let directoryUrl = packageDirectory.url;
  while (directoryUrl) {
    const candidateUrl = `${directoryUrl}node_modules/${packageName}/`;
    if (existsSync(new URL(`${candidateUrl}package.json`))) {
      return candidateUrl;
    }
    const parentUrl = new URL("../", directoryUrl).href;
    if (parentUrl === directoryUrl) {
      return null;
    }
    directoryUrl = parentUrl;
  }
  return null;
};

const readDeclaredVersion = (packageDirectory, packageName) => {
  const packageJSON = readPackageJSON(packageDirectory, packageDirectory.url);
  if (!packageJSON) {
    return null;
  }
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = packageJSON[field];
    if (dependencies && dependencies[packageName]) {
      return dependencies[packageName];
    }
  }
  return null;
};

// an install in progress can be caught halfway, with a package.json not written yet
const readPackageJSON = (packageDirectory, directoryUrl) => {
  if (!directoryUrl) {
    return null;
  }
  try {
    return packageDirectory.read(directoryUrl);
  } catch {
    return null;
  }
};

const isExactVersion = (declaredVersion) => {
  return /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(declaredVersion);
};
