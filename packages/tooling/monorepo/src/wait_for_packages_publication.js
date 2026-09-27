/*
 * Waits until every workspace package version is published on the registry.
 * Meant for when publishing happens elsewhere (a CI workflow for instance):
 * it tells when the versions found in package.json files can be installed.
 */

import { humanizeDuration, UNICODE } from "@jsenv/humanize";
import { waitForVersionInRegistry } from "@jsenv/package-publish/src/internal/staged_version.js";
import { collectUnpublishedPackages } from "./internal/collect_unpublished_packages.js";
import { collectWorkspacePackages } from "./internal/collect_workspace_packages.js";
import { fetchWorkspaceLatests } from "./internal/fetch_workspace_latests.js";

const REGISTRY_URL = "https://registry.npmjs.org";

export const waitForPackagesPublication = async ({
  directoryUrl,
  timeout = 15 * 60_000,
}) => {
  const workspacePackages = await collectWorkspacePackages({ directoryUrl });
  const registryLatestVersions = await fetchWorkspaceLatests(workspacePackages);
  const unpublishedPackages = await collectUnpublishedPackages({
    workspacePackages,
    registryLatestVersions,
    registryUrl: REGISTRY_URL,
  });
  if (unpublishedPackages.length === 0) {
    console.log(`${UNICODE.OK} packages are published on registry`);
    return;
  }
  console.log(`${UNICODE.INFO} ${unpublishedPackages.length} packages not published on registry yet
  - ${unpublishedPackages.map(({ packageSlug }) => packageSlug).join(`
  - `)}`);
  for (const { packageName, packageVersion } of unpublishedPackages) {
    await waitForVersionInRegistry({
      registryUrl: REGISTRY_URL,
      packageName,
      packageVersion,
      timeout,
      timeoutErrorMessage: `${packageName}@${packageVersion} is still not published on ${REGISTRY_URL} after ${humanizeDuration(timeout)}. Check whatever publishes it.`,
    });
  }
  console.log(`${UNICODE.OK} packages are published on registry`);
};
