/*
 * Update all package versions to prepare for publishing a new version
 */

import { syncPackagesVersions } from "@jsenv/monorepo";

await syncPackagesVersions({
  directoryUrl: new URL("../../", import.meta.url),
  packagesRelations: {
    "create-jsenv": [
      "jsenv-demo-node-package",
      "jsenv-demo-web",
      "jsenv-demo-web-preact",
      "jsenv-demo-web-react",
    ],
  },
});
