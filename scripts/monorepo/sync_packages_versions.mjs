/*
 * Update all package versions to prepare for publishing a new version
 */

import { syncPackagesVersions } from "@jsenv/monorepo";

await syncPackagesVersions({
  directoryUrl: new URL("../../", import.meta.url),
  packagesRelations: {
    "@jsenv/cli": [
      "jsenv-template-node-package",
      "jsenv-template-web",
      "jsenv-template-web-preact",
      "jsenv-template-web-react",
    ],
  },
});
