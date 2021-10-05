import { buildProject } from "../../../../main.js"
import * as jsenvConfig from "../../../../jsenv.config.mjs"

await buildProject({
  ...jsenvConfig,
  format: "commonjs",
  runtimeSupport: {
    node: "14.7",
  },
  buildDirectoryRelativeUrl: "packages/jsenv-sass/dist/commonjs",
  entryPointMap: {
    "./packages/jsenv-sass/main.js": "./main.cjs",
  },
  buildDirectoryClean: true,
})
