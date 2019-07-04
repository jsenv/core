import { babelCompatMap } from "../group-map/babelCompatMap.js"
import { browserScoreMap } from "../group-map/browserScoreMap.js"
import { nodeVersionScoreMap } from "../group-map/nodeVersionScoreMap.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

export const DEFAULT_COMPILE_INTO_RELATIVE_PATH = "/.dist"

export const DEFAULT_IMPORT_MAP_RELATIVE_PATH = "/importMap.json"

export const DEFAULT_BROWSER_PLATFORM_RELATIVE_PATH =
  "/node_modules/@jsenv/core/src/browser-platform-service/browser-platform/index.js"

export const DEFAULT_NODE_PLATFORM_RELATIVE_PATH =
  "/node_modules/@jsenv/core/src/node-platform-service/node-platform/index.js"

export const DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH =
  "/node_modules/@jsenv/core/src/browser-group-resolver/index.js"

export const DEFAULT_NODE_GROUP_RESOLVER_RELATIVE_PATH =
  "/node_modules/@jsenv/core/src/node-group-resolver/index.js"

export const DEFAULT_BABEL_PLUGIN_MAP = jsenvBabelPluginMap

export const DEFAULT_BABEL_COMPAT_MAP = babelCompatMap

export const DEFAULT_BROWSER_SCORE_MAP = browserScoreMap

export const DEFAULT_NODE_VERSION_SCORE_MAP = nodeVersionScoreMap
