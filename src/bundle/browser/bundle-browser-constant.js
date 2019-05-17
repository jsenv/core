const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

export const DEFAULT_IMPORT_MAP_RELATIVE_PATH = "/importMap.json"

export const DEFAULT_BUNDLE_INTO_RELATIVE_PATH = "/dist/browser"

export const DEFAULT_ENTRY_POINT_MAP = {
  main: "index.js",
}

export const DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH = `/src/browser-group-resolver/index.js`

export const DEFAULT_BABEL_CONFIG_MAP = babelConfigMap
