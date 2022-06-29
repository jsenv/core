/*
 * Start a server serving files into dist/.
 * Useful to test the files generated during the build
 * - npm run build:serve
 */

import { startBuildServer } from "@jsenv/core"

import { rootDirectoryUrl, plugins } from "../jsenv.config.mjs"

await startBuildServer({
  rootDirectoryUrl,
  plugins,
  buildDirectoryUrl: new URL("./dist/", rootDirectoryUrl),
  port: 3501,
})
