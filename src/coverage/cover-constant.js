import { cpus } from "os"
// import { launchNode } from "@jsenv/node-launcher"

export const DEFAULT_COVERAGE_RELATIVE_PATH = "/coverage/coverage-final.json"

export const DEFAULT_COVER_DESCRIPTION = {
  "/index.js": true,
  "/src/**/*.js": true,
  "/**/*.test.*": false, // contains .test. -> nope
  "/**/test/": false, // inside a test folder -> nope
}

export const DEFAULT_EXECUTE_DESCRIPTION = {
  "/test/**/*.test.js": {
    // node: {
    //   launch: launchNode,
    // },
  },
}

export const DEFAULT_MAX_PARALLEL_EXECUTION = Math.max(cpus.length - 1, 1)
