import { createLogger, UNICODE } from "@jsenv/humanize";
import { publish } from "@jsenv/package-publish/src/internal/publish.js";
import { collectWorkspacePackages } from "./internal/collect_workspace_packages.js";
import {
  compareTwoPackageVersions,
  VERSION_COMPARE_RESULTS,
} from "./internal/compare_two_package_versions.js";
import { fetchWorkspaceLatests } from "./internal/fetch_workspace_latests.js";
import { syncPackagesVersions } from "./sync_packages_versions.js";

export const publishPackages = async ({ directoryUrl, packagesRelations }) => {
  const versionsInSync = await ensureVersionsAreInSync({
    directoryUrl,
    packagesRelations,
  });
  if (!versionsInSync) {
    return;
  }

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

/*
 * Publishing while package.json files are not in sync would put on the registry
 * packages depending on versions that do not exist (or are outdated).
 * When versions are not in sync we ask permission to sync them before publishing.
 */
const ensureVersionsAreInSync = async ({ directoryUrl, packagesRelations }) => {
  const { outdatedPackageNames, versionUpdates, dependencyUpdates } =
    await syncPackagesVersions({
      logs: false,
      dryRun: true,
      directoryUrl,
      packagesRelations,
    });
  if (outdatedPackageNames.length) {
    console.warn(
      `${UNICODE.FAILURE} ${outdatedPackageNames.length} packages have a version older than the one published on registry
  - ${outdatedPackageNames.join(`
  - `)}
Run "npm run monorepo:sync_versions" and review the changes before publishing`,
    );
    return false;
  }
  const outOfSyncCount = versionUpdates.length + dependencyUpdates.length;
  if (outOfSyncCount === 0) {
    return true;
  }
  console.warn(`${UNICODE.WARNING} versions are not in sync, ${outOfSyncCount} things must be updated in package.json files
  - ${[
    ...versionUpdates.map(
      ({ packageName, from, to }) => `${packageName}: ${from} -> ${to}`,
    ),
    ...dependencyUpdates.map(
      ({ packageName, dependencyName, from, to }) =>
        `${packageName} -> ${dependencyName}: ${from} -> ${to}`,
    ),
  ].join(`
  - `)}`);
  const confirmed = await confirm(`Sync versions and publish?`);
  if (!confirmed) {
    console.log(`${UNICODE.INFO} publish aborted, versions are not in sync`);
    return false;
  }
  await syncPackagesVersions({ directoryUrl, packagesRelations });
  return true;
};

const confirm = async (question) => {
  if (!process.stdin.isTTY) {
    console.warn(
      `${UNICODE.FAILURE} cannot ask confirmation (stdin is not a TTY)`,
    );
    return false;
  }
  const { createInterface } = await import("node:readline/promises");
  const readlineInterface = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await readlineInterface.question(`${question} (y/N) `);
    return answer.trim().toLowerCase() === "y";
  } finally {
    readlineInterface.close();
  }
};
