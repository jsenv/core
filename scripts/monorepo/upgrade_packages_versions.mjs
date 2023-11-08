/*
 * Update all package versions to prepare for publishing a new version
 */

import { upgradePackagesVersions } from "@jsenv/monorepo";

await upgradePackagesVersions({
  directoryUrl: new URL("../../", import.meta.url),
});
