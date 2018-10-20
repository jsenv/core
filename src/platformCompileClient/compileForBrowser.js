import {
  compatMapBabel,
  platformToPluginNames,
  pluginNameToPlugin,
} from "@dmail/project-structure-compile-babel"
import replace from "rollup-plugin-replace"
import path from "path"
import { uneval } from "@dmail/uneval"
import { objectMap } from "../objectHelper.js"

const { rollup } = require("rollup")
const babel = require("rollup-plugin-babel")
// const nodeResolve = require("rollup-plugin-node-resolve")

const root = path.resolve(__dirname, "../../../../")
const inputFile = `${root}/src/platformCompileClient/platform/browser/index.js`

export const compileForBrowser = ({ VARS, name = "unknown", version = "0.0.0" } = {}) => {
  const pluginNames = platformToPluginNames(compatMapBabel, name, version)
  const babelPlugins = pluginNames.map(pluginNameToPlugin)

  const bundlePromise = rollup({
    input: inputFile,
    plugins: [
      replace({
        values: objectMap(VARS, (value) => uneval(value)),
      }),
      babel({
        babelrc: false,
        exclude: "node_modules/**",
        plugins: babelPlugins,
      }),
    ],
    // skip rollup warnings
    // onwarn: () => {},
  })

  return bundlePromise.then((bundle) => {
    return bundle.generate({
      format: "iife",
      sourcemap: true,
    })
  })
}
