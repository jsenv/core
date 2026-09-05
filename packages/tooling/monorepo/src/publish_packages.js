import { createLogger, createTaskLog, UNICODE } from "@jsenv/humanize";
import { publish } from "@jsenv/package-publish/src/internal/publish.js";
import {
  checkVersionStatusInRegistry,
  VERSION_STATUS,
  waitForStagedVersionToLand,
} from "@jsenv/package-publish/src/internal/staged_version.js";
import {
  compareTwoPackageVersions,
  VERSION_COMPARE_RESULTS,
} from "./internal/compare_two_package_versions.js";
import { syncPackagesVersions } from "./sync_packages_versions.js";

const REGISTRY_URL = "https://registry.npmjs.org";

export const publishPackages = async ({ directoryUrl, packagesRelations }) => {
  // the sync check already read the package.json files and the registry;
  // it hands both back so that publishing does not do it a second time
  const syncResult = await ensureVersionsAreInSync({
    directoryUrl,
    packagesRelations,
  });
  if (!syncResult) {
    return;
  }
  const { workspacePackages, registryLatestVersions } = syncResult;
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

  const token = process.env.NPM_TOKEN;
  const statusTask = createTaskLog(`check versions on registry`);
  let packageInfos;
  try {
    packageInfos = await Promise.all(
      toPublishPackageNames.map(async (packageName) => {
        const workspacePackage = workspacePackages[packageName];
        const packageVersion = workspacePackage.packageObject.version;
        const versionStatus = await checkVersionStatusInRegistry({
          registryUrl: REGISTRY_URL,
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
  const packagesToPublish = packageInfos.filter(
    ({ versionStatus }) => versionStatus === VERSION_STATUS.ABSENT,
  );
  const stagedPackages = packageInfos.filter(
    ({ versionStatus }) => versionStatus === VERSION_STATUS.STAGED,
  );

  if (packagesToPublish.length === 0 && stagedPackages.length === 0) {
    console.log(`${UNICODE.OK} packages are published on registry`);
    return;
  }
  if (packagesToPublish.length) {
    console.log(`${UNICODE.INFO} ${packagesToPublish.length} packages to publish
  - ${packagesToPublish.map(({ packageSlug }) => packageSlug).join(`
  - `)}`);
  }
  if (stagedPackages.length) {
    console.log(`${UNICODE.INFO} ${stagedPackages.length} packages staged on registry, waiting for it to publish them
  - ${stagedPackages.map(({ packageSlug }) => packageSlug).join(`
  - `)}`);
  }

  // a staged version cannot be published again, the registry only needs time to
  // expose it; the others go through "npm publish"
  for (const { packageName, packageVersion } of stagedPackages) {
    await waitForStagedVersionToLand({
      registryUrl: REGISTRY_URL,
      packageName,
      packageVersion,
      token,
    });
  }
  for (const { packageSlug, rootDirectoryUrl } of packagesToPublish) {
    await publish({
      logger: createLogger({ logLevel: "info" }),
      packageSlug,
      rootDirectoryUrl,
      registryUrl: REGISTRY_URL,
      token,
    });
  }
};

/*
 * Publishing while package.json files are not in sync would put on the registry
 * packages depending on versions that do not exist (or are outdated).
 * When versions are not in sync we ask permission to sync them before publishing.
 */
const ensureVersionsAreInSync = async ({ directoryUrl, packagesRelations }) => {
  const {
    outdatedPackageNames,
    versionUpdates,
    dependencyUpdates,
    workspacePackages,
    registryLatestVersions,
  } = await syncPackagesVersions({
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
    return null;
  }
  const outOfSyncCount = versionUpdates.length + dependencyUpdates.length;
  if (outOfSyncCount === 0) {
    return { workspacePackages, registryLatestVersions };
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
    return null;
  }
  // the dry run has mutated its own copy of the package objects; sync again on
  // freshly read files (but with what the registry already told us) so that the
  // updates are actually written and the package objects match the files
  const syncResult = await syncPackagesVersions({
    directoryUrl,
    packagesRelations,
    registryLatestVersions,
  });
  return {
    workspacePackages: syncResult.workspacePackages,
    registryLatestVersions,
  };
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
