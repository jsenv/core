/**

minimalBabelPluginArray exists so that jsenv support latest js syntax by default.
Otherwise users have to explicitely enable those syntax when they use it.

*/

import { require } from "./require.js"

const syntaxDynamicImport = require("@babel/plugin-syntax-dynamic-import")
const syntaxImportMeta = require("@babel/plugin-syntax-import-meta")
const syntaxNumericSeparator = require("@babel/plugin-syntax-numeric-separator")

export const minimalBabelPluginArray = [
  syntaxDynamicImport,
  syntaxImportMeta,
  syntaxNumericSeparator,
]
