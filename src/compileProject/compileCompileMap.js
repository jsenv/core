import {
  fileWriteFromString,
  pluginOptionMapToPluginMap,
} from "@dmail/project-structure-compile-babel"
import { envDescriptionToCompileMap } from "./envDescriptionToCompileMap/index.js"
import { getCompileMapLocalURL } from "./index.js"

const pluginMapDefault = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

export const compileCompileMap = async ({
  localRoot,
  compileInto,
  pluginMap = pluginMapDefault,
  platformUsageMap,
}) => {
  const compileMap = envDescriptionToCompileMap({
    pluginNames: Object.keys(pluginMap),
    platformUsageMap,
  })
  const file = getCompileMapLocalURL({ localRoot, compileInto })

  await fileWriteFromString(file, JSON.stringify(compileMap, null, "  "))
  console.log(`created ${file}`)
  return compileMap
}

// const path = require("path")
// compileCompileMap({
//   localRoot: path.resolve(__dirname, "../../../"),
//   compileInto: "build",
// })
