import { createTaskLog } from "@jsenv/humanize";
import { fetchLatestInRegistry } from "@jsenv/package-publish/src/internal/fetchLatestInRegistry.js";

export const fetchWorkspaceLatests = async (workspacePackages) => {
  const packageNames = Object.keys(workspacePackages);
  let done = 0;
  const total = packageNames.length;
  const latestVersions = {};
  const fetchTask = createTaskLog(`fetch latest versions`);
  try {
    await Promise.all(
      packageNames.map(async (packageName) => {
        const workspacePackage = workspacePackages[packageName];
        if (workspacePackage.packageObject.private) {
          latestVersions[packageName] = workspacePackage.packageObject.version;
        } else {
          const latestPackageInRegistry = await fetchLatestInRegistry({
            registryUrl: "https://registry.npmjs.org",
            packageName,
          });
          const registryLatestVersion =
            latestPackageInRegistry === null
              ? null
              : latestPackageInRegistry.version;
          latestVersions[packageName] = registryLatestVersion;
        }
        done++;
        fetchTask.setRightText(`${done}/${total}`);
      }),
    );
    fetchTask.done();
    return latestVersions;
  } catch (e) {
    fetchTask.fail();
    throw e;
  }
};
