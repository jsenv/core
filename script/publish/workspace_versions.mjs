/*
 * Update all package versions to prepare for publishing a new version
 */

import { updateWorkspaceVersions } from "@jsenv/package-workspace"

import { rootDirectoryUrl } from "@jsenv/core/jsenv.config.mjs"

await updateWorkspaceVersions({
  directoryUrl: rootDirectoryUrl,
})
