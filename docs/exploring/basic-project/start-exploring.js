// eslint-disable-next-line import/no-unresolved
import { startExploring } from "@jsenv/core"

startExploring({
  projectDirectoryUrl: new URL("./", import.meta.url),
  explorableConfig: {
    "./src/*.js": true,
  },
  port: 3456,
  livereloading: true,
})
