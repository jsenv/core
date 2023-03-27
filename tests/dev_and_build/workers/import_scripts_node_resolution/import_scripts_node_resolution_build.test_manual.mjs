import { startBuildServer } from "@jsenv/core"

await startBuildServer({
  buildDirectoryUrl: new URL("./dist", import.meta.url),
})
