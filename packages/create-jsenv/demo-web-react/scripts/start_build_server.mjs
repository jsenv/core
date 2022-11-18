/*
 * Start a server serving files into dist/.
 * Useful to test the files generated during the build
 * - npm run build:serve
 */

import open from "open"
import { startBuildServer } from "@jsenv/core"

import { rootDirectoryUrl, plugins } from "../jsenv.config.mjs"

const buildServer = await startBuildServer({
  rootDirectoryUrl,
  plugins,
  buildDirectoryUrl: new URL("./dist/", rootDirectoryUrl),
  port: 3501,
})
if (process.argv.includes("--open")) {
  open(`${buildServer.origin}/index.html`)
}
