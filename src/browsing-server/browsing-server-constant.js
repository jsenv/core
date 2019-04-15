const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

export const BROWSING_SERVER_DEFAULT_COMPILE_INTO = "dist"

export const BROWSING_SERVER_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE = "importMap.json"

export const BROWSING_SERVER_DEFAULT_BROWSABLE_DESCRIPTION = {
  "/index.js": true,
  "/src/**/*.js": true,
  "/test/**/*.js": true,
}

export const BROWSING_SERVER_DEFAULT_BABEL_CONFIG_MAP = babelConfigMap
