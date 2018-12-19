import path from "path"
import { rollup } from "rollup"
import babel from "rollup-plugin-babel"
import nodeResolve from "rollup-plugin-node-resolve"
import {
  pluginOptionMapToPluginMap,
  pluginMapToPluginsForPlatform,
  fileWriteFromString,
} from "@dmail/project-structure-compile-babel"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import { localRoot } from "../../../localRoot.js"

const inputRessource = `src/platform/browser/system/createSystemImporter.js`
const outputFolder = `${localRoot}/dist`
const outputRessource = `browserSystemImporter.js`
const inputFile = `${localRoot}/${inputRessource}`
const outputFile = `${outputFolder}/${outputRessource}`
const globalName = "__browserImporter__"
const pluginMap = pluginOptionMapToPluginMap({
  "proposal-json-strings": {},
  "proposal-object-rest-spread": {},
  "proposal-optional-catch-binding": {},
  "proposal-unicode-property-regex": {},
  "transform-arrow-functions": {},
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
  "transform-shorthand-properties": {},
  "transform-spread": {},
  "transform-sticky-regex": {},
  "transform-template-literals": {},
  "transform-typeof-symbol": {},
  "transform-unicode-regex": {},
})
pluginMap["transform-async-to-promises"] = [transformAsyncToPromises, {}]

export const compileBrowserSystemImporter = async () => {
  const plugins = pluginMapToPluginsForPlatform(pluginMap, "unknown", "0.0.0")

  const bundle = await rollup({
    input: inputFile,
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

  const { code, map } = await bundle.generate({
    format: "iife",
    name: globalName,
    sourcemap: true,
  })

  map.sources = map.sources.map((source) => {
    return `${path.relative(outputFolder, localRoot)}/${source}`
  })
  delete map.sourcesContent

  await Promise.all([
    fileWriteFromString(outputFile, appendSourceMappingURL(code, "./browserSystemImporter.js.map")),
    fileWriteFromString(
      `${outputFolder}/browserSystemImporter.js.map`,
      JSON.stringify(map, null, "  "),
    ),
  ])

  console.log(`${inputFile} -> ${outputFolder}/${inputRessource}`)
}

const appendSourceMappingURL = (code, sourceMappingURL) => {
  return `${code}
//# ${"sourceMappingURL"}=${sourceMappingURL}`
}
