const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

export const BUNDLE_NODE_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE = "importMap.json"

export const BUNDLE_NODE_DEFAULT_BUNDLE_INTO = "dist/node"

export const BUNDLE_NODE_DEFAULT_ENTRY_POINT_MAP = {
  main: "index.js",
}

export const BUNDLE_NODE_DEFAULT_BABEL_CONFIG_MAP = babelConfigMap
