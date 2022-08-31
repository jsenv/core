/*
 * Update all package versions to prepare for publishing a new version
 */

import { updateWorkspaceVersions } from "@jsenv/package-workspace"

import { rootDirectoryUrl } from "@jsenv/core/jsenv.config.mjs"

await updateWorkspaceVersions({
  directoryUrl: rootDirectoryUrl,
  packagesRelations: {
    "create-jsenv": [
      "jsenv-demo-node-package",
      "jsenv-demo-web",
      "jsenv-demo-web-preact",
      "jsenv-demo-web-react",
    ],
  },
})
