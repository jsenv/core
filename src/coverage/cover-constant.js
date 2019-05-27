import { cpus } from "os"
import { launchNode } from "../node-launcher/launch-node.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

export const DEFAULT_COMPILE_INTO_RELATIVE_PATH = "/.dist"

export const DEFAULT_IMPORT_MAP_RELATIVE_PATH = "/importMap.json"

export const DEFAULT_COVERAGE_RELATIVE_PATH = "/coverage/coverage-final.json"

export const DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH = "/src/browser-group-resolver/index.js"

export const DEFAULT_NODE_GROUP_RESOLVER_RELATIVE_PATH = "/src/node-group-resolver/index.js"

export const DEFAULT_COVER_DESCRIPTION = {
  "/index.js": true,
  "/src/**/*.js": true,
  "/**/*.test.*": false, // contains .test. -> nope
  "/**/test/": false, // inside a test folder -> nope
}

export const DEFAULT_EXECUTE_DESCRIPTION = {
  "/test/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
}

export const DEFAULT_BABEL_PLUGIN_MAP = jsenvBabelPluginMap

export const DEFAULT_MAX_PARALLEL_EXECUTION = Math.max(cpus.length - 1, 1)
