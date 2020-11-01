import { generateBundle, getBabelPluginMapForNode } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

generateBundle({
  ...jsenvConfig,
  format: "commonjs",
  babelPluginMap: getBabelPluginMapForNode(),
  // importmap file presence is mandatory to build jsenv bundle to commonsj format
  // this is because jsenv source files contains import.meta occurences
  // and in that case .importmap file becomes mandatory in case import.meta.resolve() is used.
  // In reality import.meta.resolve() is not yet specified and can be achieved
  // using new URL('./file.css', import.meta.url)
  // even if, of course, importmap are ignored in that case.
  // as jsenv don't use import.meta.resolve or would not rely on importmap resolution
  // we can just provide an empty importmap file
  importMapFileRelativeUrl: "./cjsbundle.importmap",
  bundleDirectoryClean: true,
})
