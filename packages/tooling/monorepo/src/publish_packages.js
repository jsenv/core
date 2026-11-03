import { createLogger, UNICODE } from "@jsenv/humanize";
import { publish } from "@jsenv/package-publish/src/internal/publish.js";
import { collectUnpublishedPackages } from "./internal/collect_unpublished_packages.js";
import {
  buildDependencyGraph,
  orderByDependencies,
} from "./internal/dependency_graph.js";
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
  const packagesToPublish = await collectUnpublishedPackages({
    workspacePackages,
    registryLatestVersions,
    registryUrl: REGISTRY_URL,
    token,
  });
  if (packagesToPublish.length === 0) {
    console.log(`${UNICODE.OK} packages are published on registry`);
    return;
  }
  // A package pins the versions of its dependencies, npm cannot install it until
  // they exist. So dependencies go first, and a package whose dependency did not
  // make it stays unpublished: the latest version on the registry stays installable.
  const dependencyGraph = buildDependencyGraph(workspacePackages);
  const publishOrder = orderByDependencies(dependencyGraph);
  packagesToPublish.sort(
    (a, b) =>
      publishOrder.indexOf(a.packageName) - publishOrder.indexOf(b.packageName),
  );
  console.log(`${UNICODE.INFO} ${packagesToPublish.length} packages to publish
  - ${packagesToPublish.map(({ packageSlug }) => packageSlug).join(`
  - `)}`);

  const notPublished = new Map();
  for (const {
    packageName,
    packageSlug,
    rootDirectoryUrl,
  } of packagesToPublish) {
    const missingDependencyName = dependencyGraph[
      packageName
    ].dependencies.find((dependencyName) => notPublished.has(dependencyName));
    if (missingDependencyName) {
      const message = `${packageSlug} skipped, it depends on ${missingDependencyName}`;
      console.warn(`${UNICODE.WARNING} ${message}`);
      notPublished.set(packageName, message);
      continue;
    }
    const { success } = await publish({
      logger: createLogger({ logLevel: "info" }),
      packageSlug,
      rootDirectoryUrl,
      registryUrl: REGISTRY_URL,
      token,
    });
    if (!success) {
      notPublished.set(packageName, `${packageSlug} failed to publish`);
    }
  }
  if (notPublished.size > 0) {
    throw new Error(`${notPublished.size} packages not published
  - ${[...notPublished.values()].join(`
  - `)}`);
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
