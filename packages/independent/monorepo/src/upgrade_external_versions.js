/*
 * Try to upgrade all packages that are external to a monorepo.
 * - "external" means a package that is not part of the monorepo
 * - "upgrade" means check if there is a more recent version on NPM registry
 * and if yes, update the version in the package.json
 *
 * Versions declared in "dependencies", "devDependencies"
 *
 * Be sure to check ../readme.md#upgrade-dependencies
 */

import { createTaskLog, UNICODE } from "@jsenv/humanize";
import { fetchLatestInRegistry } from "@jsenv/package-publish/src/internal/fetch_latest_in_registry.js";
import { collectWorkspacePackages } from "./internal/collect_workspace_packages.js";
import {
  compareTwoPackageVersions,
  VERSION_COMPARE_RESULTS,
} from "./internal/compare_two_package_versions.js";

export const upgradeExternalVersions = async ({ directoryUrl }) => {
  const internalPackages = await collectWorkspacePackages({ directoryUrl });
  const internalPackageNames = Object.keys(internalPackages);
  let externalPackages = {};
  collect_external_packages: {
    const addExternalPackage = ({
      internalPackageName,
      name,
      type,
      version,
    }) => {
      // ignore local deps
      if (
        version.startsWith("./") ||
        version.startsWith("../") ||
        version.startsWith("file:")
      ) {
        return;
      }
      // "*" means package accept anything
      // so there is no need to update it, it's always matching the latest version
      if (version === "*") {
        return;
      }
      const existing = externalPackages[name];
      if (existing) {
        externalPackages[name].push({
          internalPackageName,
          type,
          version,
        });
        return;
      }
      externalPackages[name] = [];
      externalPackages[name].push({
        internalPackageName,
        type,
        version,
      });
    };
    for (const internalPackageName of internalPackageNames) {
      const internalPackage = internalPackages[internalPackageName];
      const internalPackageObject = internalPackage.packageObject;
      const { dependencies = {}, devDependencies = {} } = internalPackageObject;
      const dependencyNames = Object.keys(dependencies);
      dependencyNames.forEach((dependencyName) => {
        addExternalPackage({
          internalPackageName,
          type: "dependencies",
          name: dependencyName,
          version: dependencies[dependencyName],
        });
      });
      const devDependencyNames = Object.keys(devDependencies);
      devDependencyNames.forEach((devDependencyName) => {
        addExternalPackage({
          internalPackageName,
          type: "devDependencies",
          name: devDependencyName,
          version: devDependencies[devDependencyName],
        });
      });
    }
  }
  const externalPackageNames = Object.keys(externalPackages);
  console.log(
    `${UNICODE.INFO} ${externalPackageNames.length} external packages found`,
  );

  const latestVersions = {};
  fetch_latest_versions: {
    let done = 0;
    const total = externalPackageNames.length;
    const fetchTask = createTaskLog(`fetch latest versions`);
    try {
      await Promise.all(
        externalPackageNames.map(async (externalPackageName) => {
          const latestPackageInRegistry = await fetchLatestInRegistry({
            registryUrl: "https://registry.npmjs.org",
            packageName: externalPackageName,
          });
          if (latestPackageInRegistry === null) {
            latestVersions[externalPackageName] = null;
            console.warn(
              `${UNICODE.WARN} "${externalPackageName}" not published on NPM`,
            );
          } else {
            const registryLatestVersion = latestPackageInRegistry.version;
            latestVersions[externalPackageName] = registryLatestVersion;
          }
          done++;
          fetchTask.setRightText(`${done}/${total}`);
        }),
      );
      fetchTask.done();
    } catch (e) {
      fetchTask.fail();
      throw e;
    }
  }

  const packageFilesToUpdate = {};
  const updates = [];
  for (const externalPackageName of externalPackageNames) {
    const externalPackageRefs = externalPackages[externalPackageName];
    for (const externalPackageRef of externalPackageRefs) {
      const internalPackageName = externalPackageRef.internalPackageName;
      const internalPackageDeps =
        internalPackages[internalPackageName].packageObject[
          externalPackageRef.type
        ];
      const versionDeclared = internalPackageDeps[externalPackageName];
      const registryLatestVersion = latestVersions[externalPackageName];
      if (registryLatestVersion === null) {
        continue;
      }
      const comparisonResult = compareTwoPackageVersions(
        versionDeclared,
        registryLatestVersion,
      );
      if (comparisonResult === VERSION_COMPARE_RESULTS.GREATER) {
        console.warn(
          `${UNICODE.WARNING} ${externalPackageName} version declared in ${internalPackageName} "${externalPackageRef.type}" (${versionDeclared}) is greater than latest version in registry (${registryLatestVersion})`,
        );
        continue;
      }
      if (comparisonResult === VERSION_COMPARE_RESULTS.SMALLER) {
        updates.push({
          packageName: internalPackageName,
          dependencyName: externalPackageName,
          from: versionDeclared,
          to: registryLatestVersion,
        });
        internalPackageDeps[externalPackageName] = registryLatestVersion;
        packageFilesToUpdate[internalPackageName] = true;
      }
    }
  }
  Object.keys(packageFilesToUpdate).forEach((packageName) => {
    const internalPackage = internalPackages[packageName];
    internalPackage.updateFile(internalPackage.packageObject);
  });
  if (updates.length === 0) {
    console.log(
      `${UNICODE.OK} all versions declared in package.json files are in up-to-date with registry`,
    );
  } else {
    console.log(
      `${UNICODE.INFO} ${updates.length} versions modified in package.json files
Use a tool like "git diff" to review these changes then run "npm install"`,
    );
  }
  return updates;
};
