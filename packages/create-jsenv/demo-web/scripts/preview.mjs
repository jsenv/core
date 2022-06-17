import { startBuildServer } from "@jsenv/core"

import { rootDirectoryUrl } from "../jsenv.config.mjs"

export const server = await startBuildServer({
  rootDirectoryUrl,
  buildDirectoryUrl: new URL("./dist/", rootDirectoryUrl),
  port: 3500,
})
