/*
 * Update all package versions to prepare for publishing a new version
 * TODO: ideally update "create-jsenv" when any of the dependencies in
 * packages/create-jsenv/demo-/package.json is updated
 */

import { updateWorkspaceVersions } from "@jsenv/package-workspace"

import { rootDirectoryUrl } from "@jsenv/core/jsenv.config.mjs"

await updateWorkspaceVersions({
  directoryUrl: rootDirectoryUrl,
})
