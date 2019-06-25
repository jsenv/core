const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

export const DEFAULT_COMPILE_INTO_RELATIVE_PATH = "/.dist"

export const DEFAULT_IMPORT_MAP_RELATIVE_PATH = "/importMap.json"

export const DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH = "/src/browser-group-resolver/index.js"

export const DEFAULT_BROWSER_CLIENT_RELATIVE_PATH = `/src/browser-client`

export const DEFAULT_EXPLORABLE_MAP = {
  "/index.js": true,
  "/src/**/*.js": true,
  "/test/**/*.js": true,
}

export const DEFAULT_BABEL_PLUGIN_MAP = jsenvBabelPluginMap
