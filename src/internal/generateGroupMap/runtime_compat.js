import { createOneRuntimeCompat } from "./one_runtime_compat.js"

export const createRuntimeCompat = ({
  runtimeSupport,

  babelPluginMap,
  babelPluginCompatMap,

  jsenvPluginMap,
  jsenvPluginCompatMap,
}) => {
  const minRuntimeVersions = {}
  const babelPluginRequiredNameArray = []
  const jsenvPluginRequiredNameArray = []
  Object.keys(runtimeSupport).forEach((runtimeName) => {
    const runtimeVersion = runtimeSupport[runtimeName]
    const oneRuntimeCompat = createOneRuntimeCompat({
      runtimeName,
      runtimeVersion,

      babelPluginMap,
      babelPluginCompatMap,

      jsenvPluginMap,
      jsenvPluginCompatMap,
    })

    minRuntimeVersions[runtimeName] = oneRuntimeCompat.minRuntimeVersion
    oneRuntimeCompat.babelPluginRequiredNameArray.forEach((babelPluginName) => {
      if (!babelPluginRequiredNameArray.includes(babelPluginName)) {
        babelPluginRequiredNameArray.push(babelPluginName)
      }
    })
    oneRuntimeCompat.jsenvPluginRequiredNameArray.forEach((jsenvPluginName) => {
      if (!jsenvPluginRequiredNameArray.includes(jsenvPluginName)) {
        jsenvPluginRequiredNameArray.push(jsenvPluginName)
      }
    })
  })

  return {
    babelPluginRequiredNameArray,
    jsenvPluginRequiredNameArray,
    minRuntimeVersions,
  }
}
