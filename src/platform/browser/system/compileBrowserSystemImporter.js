import path from "path"
import { rollup } from "rollup"
import babel from "rollup-plugin-babel"
import nodeResolve from "rollup-plugin-node-resolve"
import { fileWrite } from "@dmail/helper"
import {
  pluginOptionMapToPluginMap,
  pluginMapToPluginsForPlatform,
} from "@dmail/project-structure-compile-babel"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import { projectFolder } from "../../../projectFolder.js"

const inputRessource = `src/platform/browser/system/createSystemImporter.js`
const outputFolder = `${projectFolder}/dist`
const outputRessource = `browserSystemImporter.js`
const inputFile = `${projectFolder}/${inputRessource}`
const outputFile = `${outputFolder}/${outputRessource}`
const globalName = "__browserImporter__"
const babelPluginDescription = pluginOptionMapToPluginMap({
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
babelPluginDescription["transform-async-to-promises"] = [transformAsyncToPromises, {}]

export const compileBrowserSystemImporter = async () => {
  const plugins = pluginMapToPluginsForPlatform(babelPluginDescription, "unknown", "0.0.0")

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

  const { output } = await bundle.generate({
    format: "iife",
    name: globalName,
    sourcemap: true,
  })
  const { code, map } = output[0]

  map.sources = map.sources.map((source) => {
    return `${path.relative(outputFolder, projectFolder)}/${source}`
  })
  delete map.sourcesContent

  await Promise.all([
    fileWrite(outputFile, appendSourceMappingURL(code, "./browserSystemImporter.js.map")),
    fileWrite(`${outputFolder}/browserSystemImporter.js.map`, JSON.stringify(map, null, "  ")),
  ])

  console.log(`${inputFile} -> ${outputFolder}/${inputRessource}`)
}

const appendSourceMappingURL = (code, sourceMappingURL) => {
  return `${code}
//# ${"sourceMappingURL"}=${sourceMappingURL}`
}
