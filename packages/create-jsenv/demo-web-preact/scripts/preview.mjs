import { startBuildServer } from "@jsenv/core"

import { rootDirectoryUrl, plugins } from "../jsenv.config.mjs"

export const server = await startBuildServer({
  rootDirectoryUrl,
  plugins,
  buildDirectoryUrl: new URL("./dist/", rootDirectoryUrl),
  port: 3501,
})
