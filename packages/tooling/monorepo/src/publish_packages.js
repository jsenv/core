import { createLogger, UNICODE } from "@jsenv/humanize";
import { publish } from "@jsenv/package-publish/src/internal/publish.js";
import {
  VERSION_STATUS,
  waitForStagedVersionToLand,
} from "@jsenv/package-publish/src/internal/staged_version.js";
import { collectUnpublishedPackages } from "./internal/collect_unpublished_packages.js";
import { syncPackagesVersions } from "./sync_packages_versions.js";

const REGISTRY_URL = "https://registry.npmjs.org";

export const publishPackages = async ({ directoryUrl, packagesRelations }) => {
  // the sync check already read the package.json files and the registry;
  // it hands both back so that publishing does not do it a second time
  const { workspacePackages, registryLatestVersions } =
    await ensureVersionsAreInSync({
      directoryUrl,
      packagesRelations,
    });
  const token = process.env.NPM_TOKEN;
  const unpublishedPackages = await collectUnpublishedPackages({
    workspacePackages,
    registryLatestVersions,
    registryUrl: REGISTRY_URL,
    token,
  });
  const packagesToPublish = unpublishedPackages.filter(
    ({ versionStatus }) => versionStatus === VERSION_STATUS.ABSENT,
  );
  const stagedPackages = unpublishedPackages.filter(
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
    const { success } = await publish({
      logger: createLogger({ logLevel: "info" }),
      packageSlug,
      rootDirectoryUrl,
      registryUrl: REGISTRY_URL,
      token,
    });
    if (!success) {
      throw new Error(`failed to publish ${packageSlug}`);
    }
  }
};

/*
 * Publishing while package.json files are not in sync would put on the registry
 * packages depending on versions that do not exist (or are outdated).
 * Syncing modifies package.json files, a change to review and commit, so it is
 * never done here: the publish fails instead.
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
    throw new Error(
      `${outdatedPackageNames.length} packages have a version older than the one published on registry
  - ${outdatedPackageNames.join(`
  - `)}
Run "npm run monorepo:sync_versions" and review the changes before publishing`,
    );
  }
  const outOfSyncCount = versionUpdates.length + dependencyUpdates.length;
  if (outOfSyncCount) {
    throw new Error(`versions are not in sync, ${outOfSyncCount} things must be updated in package.json files
  - ${[
    ...versionUpdates.map(
      ({ packageName, from, to }) => `${packageName}: ${from} -> ${to}`,
    ),
    ...dependencyUpdates.map(
      ({ packageName, dependencyName, from, to }) =>
        `${packageName} -> ${dependencyName}: ${from} -> ${to}`,
    ),
  ].join(`
  - `)}
Run "npm run monorepo:sync_versions" and review the changes before publishing`);
  }
  return { workspacePackages, registryLatestVersions };
};
