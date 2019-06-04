import { nodeVersionScoreMap } from "../../group-map/index.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

export const DEFAULT_BUNDLE_INTO_RELATIVE_PATH = "/dist/commonjs"

export const DEFAULT_IMPORT_MAP_RELATIVE_PATH = "/importMap.json"

export const DEFAULT_ENTRY_POINT_MAP = {
  main: "index.js",
}

export const DEFAULT_PLATFORM_GROUP_RESOLVER_RELATIVE_PATH = "/src/platform-group-resolver/index.js"

export const DEFAULT_BABEL_PLUGIN_MAP = jsenvBabelPluginMap

export const DEFAULT_PLATFORM_SCORE_MAP = {
  node: nodeVersionScoreMap,
}
