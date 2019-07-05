import { cpus } from "os"
// import { launchNode } from "@jsenv/node-launcher"

export const DEFAULT_EXECUTE_DESCRIPTION = {
  "/test/**/*.test.js": {
    // node: {
    //   launch: launchNode,
    // },
  },
}

export const DEFAULT_MAX_PARALLEL_EXECUTION = Math.max(cpus.length - 1, 1)
