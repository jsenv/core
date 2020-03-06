/* eslint-disable import/no-unresolved */
import { execute, launchFirefox } from "@jsenv/core"

execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  launch: launchFirefox,
  fileRelativeUrl: process.argv[2],
  stopAfterExecute: true,
})
