import { createTaskLog } from "@jsenv/humanize";
import { checkVersionIsInRegistry } from "@jsenv/package-publish/src/internal/version_in_registry.js";
import {
  compareTwoPackageVersions,
  VERSION_COMPARE_RESULTS,
} from "./compare_two_package_versions.js";

/*
 * The workspace packages whose version is not published on the registry
 */
export const collectUnpublishedPackages = async ({
  workspacePackages,
  registryLatestVersions,
  registryUrl,
  token,
}) => {
  const aheadPackageNames = Object.keys(workspacePackages).filter(
    (packageName) => {
      const workspacePackage = workspacePackages[packageName];
      const registryLatestVersion = registryLatestVersions[packageName];
      if (registryLatestVersion === null) {
        return true;
      }
      const result = compareTwoPackageVersions(
        workspacePackage.packageObject.version,
        registryLatestVersion,
      );
      return (
        result === VERSION_COMPARE_RESULTS.GREATER ||
        result === VERSION_COMPARE_RESULTS.DIFF_TAG
      );
    },
  );
  if (aheadPackageNames.length === 0) {
    return [];
  }

  const statusTask = createTaskLog(`check versions on registry`);
  let packageInfos;
  try {
    packageInfos = await Promise.all(
      aheadPackageNames.map(async (packageName) => {
        const workspacePackage = workspacePackages[packageName];
        const packageVersion = workspacePackage.packageObject.version;
        const versionIsInRegistry = await checkVersionIsInRegistry({
          registryUrl,
          packageName,
          packageVersion,
          token,
        });
        return {
          packageName,
          packageVersion,
          packageSlug: `${packageName}@${packageVersion}`,
          rootDirectoryUrl: new URL("./", workspacePackage.packageUrl),
          versionIsInRegistry,
        };
      }),
    );
    statusTask.done();
  } catch (e) {
    statusTask.fail();
    throw e;
  }
  return packageInfos.filter(({ versionIsInRegistry }) => !versionIsInRegistry);
};
