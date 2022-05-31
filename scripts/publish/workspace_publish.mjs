/*
 * Publish all package if needed (the local package version must not be published)
 */

import { readFile } from "@jsenv/filesystem"

import { publishWorkspace } from "@jsenv/package-workspace"

import { rootDirectoryUrl } from "@jsenv/core/jsenv.config.mjs"

if (!process.env.CI) {
  const secrets = await readFile(
    new URL("../../secrets.json", import.meta.url),
    { as: "json" },
  )
  Object.assign(process.env, secrets)
}
await publishWorkspace({
  directoryUrl: rootDirectoryUrl,
})
