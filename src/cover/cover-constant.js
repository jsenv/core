import { cpus } from "os"
import { launchNode } from "../node-launcher/launch-node.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

export const DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE =
  "src/browser-group-resolver/index.js"

export const DEFAULT_NODE_GROUP_RESOLVER_FILENAME_RELATIVE = "src/node-group-resolver/index.js"

export const DEFAULT_IMPORT_MAP_FILENAME_RELATIVE = "importMap.json"

export const DEFAULT_COVERAGE_FILENAME_RELATIVE = "coverage/coverage-final.json"

export const DEFAULT_COMPILE_INTO = ".dist"

export const DEFAULT_COVER_DESCRIPTION = {
  "/index.js": true,
  "/src/**/*.js": true,
}

export const DEFAULT_EXECUTE_DESCRIPTION = {
  "/test/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
}

export const DEFAULT_BABEL_CONFIG_MAP = babelConfigMap

export const DEFAULT_MAX_PARALLEL_EXECUTION = Math.max(cpus.length - 1, 1)
