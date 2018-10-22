import {
  pluginOptionMapToPluginMap,
  pluginMapToPluginsForPlatform,
} from "@dmail/project-structure-compile-babel"
import path from "path"

const { rollup } = require("rollup")
const babel = require("rollup-plugin-babel")

const root = path.resolve(__dirname, "../../../")
const inputFile = `${root}/src/platform/type/browser/index.js`
const pluginMap = pluginOptionMapToPluginMap({
  "proposal-async-generator-functions": {},
  "proposal-json-strings": {},
  "proposal-object-rest-spread": {},
  "proposal-optional-catch-binding": {},
  "proposal-unicode-property-regex": {},
  "transform-arrow-functions": {},
  "transform-async-to-generator": {},
  "transform-block-scoped-functions": {},
  "transform-block-scoping": {},
  "transform-classes": {},
  "transform-computed-properties": {},
  "transform-destructuring": {},
  "transform-dotall-regex": {},
  "transform-duplicate-keys": {},
  "transform-exponentiation-operator": {},
  "transform-for-of": {},
  "transform-function-name": {},
  "transform-literals": {},
  "transform-new-target": {},
  "transform-object-super": {},
  "transform-parameters": {},
  "transform-regenerator": {},
  "transform-shorthand-properties": {},
  "transform-spread": {},
  "transform-sticky-regex": {},
  "transform-template-literals": {},
  "transform-typeof-symbol": {},
  "transform-unicode-regex": {},
})

export const compileForBrowser = ({ name = "unknown", version = "0.0.0" } = {}) => {
  const plugins = pluginMapToPluginsForPlatform(pluginMap, name, version)

  const bundlePromise = rollup({
    input: inputFile,
    plugins: [
      babel({
        babelrc: false,
        exclude: "node_modules/**",
        plugins,
      }),
    ],
    // skip rollup warnings
    // onwarn: () => {},
  })

  return bundlePromise.then((bundle) => {
    return bundle.generate({
      format: "iife",
      name: "__createPlatform__",
      sourcemap: true,
    })
  })
}
