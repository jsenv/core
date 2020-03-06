/* eslint-disable import/no-unresolved */
import { execute, launchChromium } from "@jsenv/core"

execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  launch: launchChromium,
  fileRelativeUrl: process.argv[2],
  stopAfterExecute: true,
})
