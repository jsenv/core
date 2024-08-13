import { createLogger, UNICODE } from "@jsenv/humanize";
import { publish } from "@jsenv/package-publish/src/internal/publish.js";
import { collectWorkspacePackages } from "./internal/collect_workspace_packages.js";
import { fetchWorkspaceLatests } from "./internal/fetch_workspace_latests.js";
import {
  compareTwoPackageVersions,
  VERSION_COMPARE_RESULTS,
} from "./internal/compare_two_package_versions.js";

export const publishPackages = async ({ directoryUrl }) => {
  const workspacePackages = await collectWorkspacePackages({ directoryUrl });
  const registryLatestVersions = await fetchWorkspaceLatests(workspacePackages);
  const toPublishPackageNames = Object.keys(workspacePackages).filter(
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
  if (toPublishPackageNames.length === 0) {
    console.log(`${UNICODE.OK} packages are published on registry`);
    return;
  }

  const packageSlugs = toPublishPackageNames.map(
    (name) => `${name}@${workspacePackages[name].packageObject.version}`,
  );

  console.log(`${UNICODE.INFO} ${
    toPublishPackageNames.length
  } packages to publish
  - ${packageSlugs.join(`
  - `)}`);
  await toPublishPackageNames.reduce(
    async (previous, toPublishPackageName, index) => {
      await previous;
      await publish({
        logger: createLogger({ logLevel: "info" }),
        packageSlug: packageSlugs[index],
        rootDirectoryUrl: new URL(
          "./",
          workspacePackages[toPublishPackageName].packageUrl,
        ),
        registryUrl: "https://registry.npmjs.org",
        token: process.env.NPM_TOKEN,
      });
    },
    Promise.resolve(),
  );
};
