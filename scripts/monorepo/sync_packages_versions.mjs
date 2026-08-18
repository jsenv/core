/*
 * Update all package versions to prepare for publishing a new version
 */

import { syncPackagesVersions } from "@jsenv/monorepo";
import { packagesRelations } from "./packages_relations.mjs";

await syncPackagesVersions({
  directoryUrl: new URL("../../", import.meta.url),
  packagesRelations,
});
