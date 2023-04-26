import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { requireFromJsenv } from "@jsenv/core/src/helpers/require_from_jsenv.js"

const babelPluginPackagePath = requireFromJsenv.resolve("@jsenv/babel-plugins")
const babelPluginPackageUrl = pathToFileURL(babelPluginPackagePath)

export const requireBabelPlugin = createRequire(babelPluginPackageUrl)
