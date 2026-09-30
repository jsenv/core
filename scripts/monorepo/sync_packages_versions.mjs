/*
 * Update all package versions to prepare for publishing a new version
 */

import { syncPackagesVersions } from "@jsenv/monorepo";
import { packagesRelations } from "./packages_relations.mjs";
import { readVersionsNamedByPublishCommits } from "./publish_commit.mjs";

const directoryUrl = new URL("../../", import.meta.url);
await syncPackagesVersions({
  directoryUrl,
  packagesRelations,
  takenVersions: readVersionsNamedByPublishCommits(directoryUrl),
});
