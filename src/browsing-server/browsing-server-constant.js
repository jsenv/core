const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

export const DEFAULT_COMPILE_INTO = "dist"

export const DEFAULT_IMPORT_MAP_FILENAME_RELATIVE = "importMap.json"

export const DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/browser-group-resolver/index.js"

export const DEFAULT_BROWSABLE_DESCRIPTION = {
  "/index.js": true,
  "/src/**/*.js": true,
  "/test/**/*.js": true,
}

export const DEFAULT_BABEL_CONFIG_MAP = babelConfigMap
