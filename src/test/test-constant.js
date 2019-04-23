import { launchNode } from "../node-launcher/launchNode.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

export const TEST_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE = "importMap.json"

export const TEST_DEFAULT_COMPILE_INTO = ".dist"

export const TEST_DEFAULT_EXECUTE_DESCRIPTION = {
  "/test/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
}

export const TEST_DEFAULT_BABEL_CONFIG_MAP = babelConfigMap
