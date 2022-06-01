import { parentPort } from "node:worker_threads"
import { startBuildServer } from "@jsenv/core"

import { rootDirectoryUrl, plugins } from "../jsenv.config.mjs"

export const server = await startBuildServer({
  rootDirectoryUrl,
  plugins,
  buildDirectoryUrl: new URL("./dist/", rootDirectoryUrl),
  buildServerMainFile: import.meta.url,
  // disable autoreload when inside worker thread (happen when launched by performance.mjs)
  buildServerAutoreload: !parentPort,
})
