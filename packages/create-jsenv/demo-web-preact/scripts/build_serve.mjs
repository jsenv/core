/*
 * Start a server serving files into dist/.
 * Useful to test the files generated during the build
 * - npm run build:serve
 */

import open from "open"
import { startBuildServer } from "@jsenv/core"

const buildServer = await startBuildServer({
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  port: 3501,
})
if (process.argv.includes("--open")) {
  open(buildServer.origin)
}
