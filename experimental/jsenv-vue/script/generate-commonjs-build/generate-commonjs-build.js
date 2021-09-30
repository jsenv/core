import { buildProject } from "../../../../main.js"
import * as jsenvConfig from "../../../../jsenv.config.js"

await buildProject({
  ...jsenvConfig,
  format: "commonjs",
  runtimeSupport: {
    node: "14.7",
  },
  buildDirectoryRelativeUrl: "packages/jsenv-vue/dist/commonjs",
  entryPointMap: {
    "./packages/jsenv-vue/main.js": "./main.cjs",
  },
  buildDirectoryClean: true,
})
