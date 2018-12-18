import { rollup } from "rollup"
import babel from "rollup-plugin-babel"
import nodeResolve from "rollup-plugin-node-resolve"
import {
  pluginOptionMapToPluginMap,
  pluginMapToPluginsForPlatform,
  fileSystemWriteCompileResult,
} from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"

const inputFile = `src/platform/browser/system/createSystemImporter.js`
const outputFolder = "dist"
const outputFile = `browserSystemImporter.js`
const globalName = "__browserImporter__"
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

export const compileBrowserSystemImporter = async () => {
  const plugins = pluginMapToPluginsForPlatform(pluginMap, "unknown", "0.0.0")

  const bundle = await rollup({
    input: `${localRoot}/${inputFile}`,
    plugins: [
      nodeResolve({
        module: true,
      }),
      babel({
        babelrc: false,
        exclude: "node_modules/**",
        plugins,
      }),
    ],
    // comment line below to skip rollup warnings
    // onwarn: () => {},
  })

  const compileResult = await bundle.generate({
    format: "iife",
    name: globalName,
    sourcemap: true,
  })

  await fileSystemWriteCompileResult(compileResult, {
    localRoot,
    outputFile,
    outputFolder,
  })
  console.log(`${inputFile} -> ${outputFolder}/${outputFile}`)
}
