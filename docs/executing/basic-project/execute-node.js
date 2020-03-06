/* eslint-disable import/no-unresolved */
import { execute, launchNode } from "@jsenv/core"

execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  launch: launchNode,
  fileRelativeUrl: process.argv[2],
})
