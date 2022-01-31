import { execute, nodeRuntime } from "@jsenv/core"

import * as jsenvConfig from "../../jsenv.config.mjs"

await execute({
  ...jsenvConfig,
  runtime: nodeRuntime,
  runtimeParams: {
    debugPort: 40000,
  },
  fileRelativeUrl: process.argv[2],
})
