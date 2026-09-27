import { createTaskLog } from "@jsenv/humanize";
import {
  checkVersionStatusInRegistry,
  VERSION_STATUS,
} from "@jsenv/package-publish/src/internal/staged_version.js";
import {
  compareTwoPackageVersions,
  VERSION_COMPARE_RESULTS,
} from "./compare_two_package_versions.js";

/*
 * The workspace packages whose version is not published on the registry, each
 * with its status there: absent, or staged (the registry has it but does not
 * expose it yet)
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
        const versionStatus = await checkVersionStatusInRegistry({
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
          versionStatus,
        };
      }),
    );
    statusTask.done();
  } catch (e) {
    statusTask.fail();
    throw e;
  }
  return packageInfos.filter(
    ({ versionStatus }) => versionStatus !== VERSION_STATUS.PUBLISHED,
  );
};
