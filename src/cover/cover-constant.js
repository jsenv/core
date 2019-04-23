import { launchNode } from "../node-launcher/launchNode.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

export const COVER_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE = "importMap.json"

export const COVER_DEFAULT_COVERAGE_FILENAME_RELATIVE = "coverage/coverage-final.json"

export const COVER_DEFAULT_COMPILE_INTO = ".dist"

export const COVER_DEFAULT_COVER_DESCRIPTION = {
  "/index.js": true,
  "/src/**/*.js": true,
}

export const COVER_DEFAULT_EXECUTE_DESCRIPTION = {
  "/test/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
}

export const COVER_DEFAULT_BABEL_CONFIG_MAP = babelConfigMap
