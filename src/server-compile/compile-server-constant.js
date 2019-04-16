import { babelCompatMap } from "../group-map/babelCompatMap.js"
import { browserScoreMap } from "../group-map/browserScoreMap.js"
import { nodeVersionScoreMap } from "../group-map/nodeVersionScoreMap.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

export const COMPILE_SERVER_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE = "importMap.json"

export const COMPILE_SERVER_DEFAULT_COMPILE_INTO = ".dist"

export const COMPILE_SERVER_DEFAULT_BABEL_CONFIG_MAP = babelConfigMap

export const COMPILE_SERVER_DEFAULT_BABEL_COMPAT_MAP = babelCompatMap

export const COMPILE_SERVER_DEFAULT_BROWSER_SCORE_MAP = browserScoreMap

export const COMPILE_SERVER_DEFAULT_NODE_VERSION_SCORE_MAP = nodeVersionScoreMap
