import { require } from "@jsenv/core/src/internal/require.js"

export const babelPluginNamesToRemoveFromBest = [
  "proposal-private-property-in-object",
  "proposal-logical-assignment-operators",
  "proposal-export-namespace-from",
  "proposal-class-properties",
  "proposal-private-methods",
  "transform-named-capturing-groups-regex",
]

export const getMinimalBabelPluginMap = () => {
  const syntaxDynamicImport = require("@babel/plugin-syntax-dynamic-import")
  const syntaxImportMeta = require("@babel/plugin-syntax-import-meta")
  const syntaxNumericSeparator = require("@babel/plugin-syntax-numeric-separator")

  return {
    "syntax-dynamic-import": syntaxDynamicImport,
    "syntax-import-meta": syntaxImportMeta,
    "syntax-numeric-separator": syntaxNumericSeparator,
  }
}

export const extractSyntaxBabelPluginMap = (babelPluginMap) => {
  const babelSyntaxPluginMap = {}
  const babelPluginMapWithoutSyntax = {}
  Object.keys(babelPluginMap).forEach((key) => {
    if (key.startsWith("syntax-")) {
      babelSyntaxPluginMap[key] = babelPluginMap[key]
    } else {
      babelPluginMapWithoutSyntax[key] = babelPluginMap[key]
    }
  })
  return {
    babelSyntaxPluginMap,
    babelPluginMapWithoutSyntax,
  }
}

export const babelPluginsFromBabelPluginMap = (babelPluginMap) => {
  return Object.keys(babelPluginMap).map(
    (babelPluginName) => babelPluginMap[babelPluginName],
  )
}
