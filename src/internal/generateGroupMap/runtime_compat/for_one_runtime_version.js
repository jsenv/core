import { createRuntimeCompatForRuntime } from "./for_runtime.js"
import { composeRuntimeCompatMap } from "./runtime_compat_composition.js"

export const createRuntimeCompatForOneRuntimeVersion = ({
  runtimeSupport,

  babelPluginMap,
  babelPluginCompatMap,

  jsenvPluginMap,
  jsenvPluginCompatMap,
}) => {
  const runtimeCompatsForOneVersion = []
  Object.keys(runtimeSupport).forEach((runtimeName) => {
    const runtimeVersion = runtimeSupport[runtimeName]

    const runtimeCompat = createRuntimeCompatForRuntime({
      runtimeName,
      runtimeVersion,

      babelPluginMap,
      babelPluginCompatMap,

      jsenvPluginMap,
      jsenvPluginCompatMap,
    })

    const runtimeCompatWithSameRequirements = runtimeCompatsForOneVersion.find(
      (runtimeCompatCandidate) => {
        return sameRequirements(runtimeCompatCandidate, runtimeCompat)
      },
    )

    if (runtimeCompatWithSameRequirements) {
      runtimeCompatWithSameRequirements.runtimeCompatMap =
        composeRuntimeCompatMap(
          runtimeCompatWithSameRequirements.runtimeCompatMap,
          runtimeCompat.runtimeCompatMap,
        )
    } else {
      runtimeCompatsForOneVersion.push(runtimeCompat)
    }
  })
  return runtimeCompatsForOneVersion
}

const sameRequirements = (left, right) => {
  return (
    left.babelPluginRequiredNameArray.join("") ===
      right.babelPluginRequiredNameArray.join("") &&
    left.jsenvPluginRequiredNameArray.join("") ===
      right.jsenvPluginRequiredNameArray.join("")
  )
}
