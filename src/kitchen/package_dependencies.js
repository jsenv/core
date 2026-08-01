/*
 * Compares what a package.json declares with what is actually inside
 * node_modules, so the dev server can tell a dependency apart when it is
 * missing (never installed) or outdated (installed at an other version).
 *
 * Only the dependencies declared by a package are looked at, never the
 * transitive ones: a declared dependency is what pulls the rest, so it is
 * enough to know whether an install is needed or over.
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

/*
 * declaringDirectoryUrl is the package directory the importer belongs to, which
 * is not always the project one: a file inside node_modules resolves its bare
 * specifiers against the dependencies of the package containing it.
 */
export const readDependencyStatus = (
  packageDirectory,
  packageName,
  declaringDirectoryUrl = packageDirectory.url,
) => {
  const packageJSON = readPackageJSON(packageDirectory, declaringDirectoryUrl);
  if (!packageJSON) {
    return null;
  }
  const declaredVersion = readDeclaredVersion(packageJSON, packageName);
  if (!declaredVersion) {
    return null;
  }
  return createStatus(packageDirectory, {
    packageName,
    declaredVersion,
    declaringDirectoryUrl,
    declaredBy: packageJSON.name,
  });
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
        createStatus(packageDirectory, {
          packageName,
          declaredVersion: dependencies[packageName],
          declaringDirectoryUrl: packageDirectory.url,
          declaredBy: packageJSON.name,
        }),
      );
    }
  }
  return statuses;
};

const createStatus = (
  packageDirectory,
  { packageName, declaredVersion, declaringDirectoryUrl, declaredBy },
) => {
  const status = {
    packageName,
    declaredVersion,
    declaredBy,
    installedVersion: null,
    state: "missing",
  };
  const installedDirectoryUrl = findInstalledDirectoryUrl(
    declaringDirectoryUrl,
    packageName,
  );
  if (!installedDirectoryUrl) {
    return status;
  }
  const installedPackageJSON = readPackageJSON(
    packageDirectory,
    installedDirectoryUrl,
  );
  status.installedVersion = installedPackageJSON
    ? installedPackageJSON.version
    : null;
  status.state =
    isExactVersion(declaredVersion) &&
    status.installedVersion !== declaredVersion
      ? "outdated"
      : "installed";
  return status;
};

const findInstalledDirectoryUrl = (declaringDirectoryUrl, packageName) => {
  let directoryUrl = declaringDirectoryUrl;
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

const readDeclaredVersion = (packageJSON, packageName) => {
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
