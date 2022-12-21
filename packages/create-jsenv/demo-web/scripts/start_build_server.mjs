/*
 * Start a server serving files into dist/.
 * Useful to test the files generated during the build
 * - npm run build:serve
 */

import open from "open"
import { startBuildServer } from "@jsenv/core"

const buildServer = await startBuildServer({
  rootDirectoryUrl: new URL("../", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  port: 3500,
})
if (process.argv.includes("--open")) {
  open(`${buildServer.origin}/index.html`)
}
